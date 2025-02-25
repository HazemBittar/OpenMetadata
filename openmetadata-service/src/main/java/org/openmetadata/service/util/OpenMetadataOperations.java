package org.openmetadata.service.util;

import static org.flywaydb.core.internal.info.MigrationInfoDumper.dumpToAsciiTable;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.timestampToString;
import static org.openmetadata.service.formatter.decorators.MessageDecorator.getDateStringEpochMilli;
import static org.openmetadata.service.jdbi3.UserRepository.AUTH_MECHANISM_FIELD;
import static org.openmetadata.service.util.AsciiTable.printOpenMetadataText;
import static org.openmetadata.service.util.UserUtil.updateUserWithHashedPwd;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Scanner;
import java.util.Set;
import java.util.concurrent.Callable;
import javax.json.JsonPatch;
import javax.validation.Validator;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppConfiguration;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.apps.AppMapper;
import org.openmetadata.service.resources.apps.AppMarketPlaceMapper;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsManagerUpdateService;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.jdbi.DatabaseAuthenticationProviderFactory;
import org.openmetadata.service.util.jdbi.JdbiUtils;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

@Slf4j
@Command(
    name = "OpenMetadataSetup",
    mixinStandardHelpOptions = true,
    version = "OpenMetadataSetup 1.3",
    description =
        "Creates or Migrates Database/Search Indexes. ReIndex the existing data into Elastic Search "
            + "or OpenSearch. Re-Deploys the service pipelines.")
public class OpenMetadataOperations implements Callable<Integer> {

  private OpenMetadataApplicationConfig config;
  private Flyway flyway;
  private Jdbi jdbi;
  private SearchRepository searchRepository;
  private String nativeSQLScriptRootPath;
  private String extensionSQLScriptRootPath;
  private SecretsManager secretsManager;
  private CollectionDAO collectionDAO;

  @Option(
      names = {"-d", "--debug"},
      defaultValue = "false")
  private boolean debug;

  @Option(
      names = {"-c", "--config"},
      required = true)
  private String configFilePath;

  @Override
  public Integer call() {
    LOG.info(
        "Subcommand needed: 'info', 'validate', 'repair', 'check-connection', "
            + "'drop-create', 'changelog', 'migrate', 'migrate-secrets', 'reindex', 'deploy-pipelines'");
    return 0;
  }

  @Command(
      name = "info",
      description =
          "Shows the list of migrations applied and the pending migration "
              + "waiting to be applied on the target database")
  public Integer info() {
    try {
      parseConfig();
      LOG.info(dumpToAsciiTable(flyway.info().all()));
      return 0;
    } catch (Exception e) {
      LOG.error("Failed due to ", e);
      return 1;
    }
  }

  @Command(
      name = "validate",
      description =
          "Checks if the all the migrations haven been applied " + "on the target database.")
  public Integer validate() {
    try {
      parseConfig();
      flyway.validate();
      return 0;
    } catch (Exception e) {
      LOG.error("Database migration validation failed due to ", e);
      return 1;
    }
  }

  @Command(
      name = "repair",
      description =
          "Repairs the DATABASE_CHANGE_LOG table which is used to track"
              + "all the migrations on the target database This involves removing entries for the failed migrations and update"
              + "the checksum of migrations already applied on the target database")
  public Integer repair() {
    try {
      parseConfig();
      flyway.repair();
      return 0;
    } catch (Exception e) {
      LOG.error("Repair of CHANGE_LOG failed due to ", e);
      return 1;
    }
  }

  @Command(
      name = "setOpenMetadataUrl",
      description = "Set or update the OpenMetadata URL in the system repository")
  public Integer setOpenMetadataUrl(
      @Option(
              names = {"-u", "--url"},
              description = "OpenMetadata URL to store in the system repository",
              required = true)
          String openMetadataUrl) {
    try {
      parseConfig();
      Settings updatedSettings =
          new Settings()
              .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
              .withConfigValue(
                  new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(openMetadataUrl));

      Entity.getSystemRepository().createOrUpdate(updatedSettings);
      LOG.info("Updated OpenMetadata URL to: {}", openMetadataUrl);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to set OpenMetadata URL due to: ", e);
      return 1;
    }
  }

  @Command(
      name = "configureEmailSettings",
      description =
          "Set or update the SMTP/Email configuration in the OpenMetadata system repository")
  public Integer configureEmailSettings(
      @Option(
              names = {"--emailingEntity"},
              description = "Identifier or entity name used for sending emails (e.g. OpenMetadata)",
              required = true)
          String emailingEntity,
      @Option(
              names = {"--supportUrl"},
              description =
                  "Support URL for help or documentation (e.g. https://slack.open-metadata.org)",
              required = true)
          String supportUrl,
      @Option(
              names = {"--enableSmtpServer"},
              description = "Flag indicating whether SMTP server is enabled (true/false)",
              required = true,
              arity = "1")
          boolean enableSmtpServer,
      @Option(
              names = {"--senderMail"},
              description = "Sender email address used for outgoing messages",
              required = true)
          String senderMail,
      @Option(
              names = {"--serverEndpoint"},
              description = "SMTP server endpoint (host)",
              required = true)
          String serverEndpoint,
      @Option(
              names = {"--serverPort"},
              description = "SMTP server port",
              required = true)
          String serverPort,
      @Option(
              names = {"--username"},
              description = "SMTP server username",
              required = true)
          String username,
      @Option(
              names = {"--password"},
              description = "SMTP server password (may be masked)",
              interactive = true,
              arity = "0..1",
              required = true)
          char[] password,
      @Option(
              names = {"--transportationStrategy"},
              description = "SMTP connection strategy (one of: SMTP, SMTPS, SMTP_TLS)",
              required = true)
          String transportationStrategy,
      @Option(
              names = {"--templatePath"},
              description = "Custom path to email templates (if needed)")
          String templatePath,
      @Option(
              names = {"--templates"},
              description = "Email templates (e.g. openmetadata, collate)",
              required = true)
          String templates) {
    try {
      parseConfig();

      SmtpSettings smtpSettings = new SmtpSettings();
      smtpSettings.setEmailingEntity(emailingEntity);
      smtpSettings.setSupportUrl(supportUrl);
      smtpSettings.setEnableSmtpServer(enableSmtpServer);
      smtpSettings.setSenderMail(senderMail);
      smtpSettings.setServerEndpoint(serverEndpoint);

      smtpSettings.setServerPort(Integer.parseInt(serverPort));

      smtpSettings.setUsername(username);
      smtpSettings.setPassword(password != null ? new String(password) : "");

      try {
        smtpSettings.setTransportationStrategy(
            SmtpSettings.TransportationStrategy.valueOf(transportationStrategy.toUpperCase()));
      } catch (IllegalArgumentException e) {
        LOG.warn(
            "Invalid transportation strategy '{}'. Falling back to SMTP_TLS.",
            transportationStrategy);
        smtpSettings.setTransportationStrategy(SmtpSettings.TransportationStrategy.SMTP_TLS);
      }

      smtpSettings.setTemplatePath(templatePath);

      try {
        smtpSettings.setTemplates(SmtpSettings.Templates.valueOf(templates.toUpperCase()));
      } catch (IllegalArgumentException e) {
        LOG.warn("Invalid template value '{}'. Falling back to OPENMETADATA.", templates);
        smtpSettings.setTemplates(SmtpSettings.Templates.OPENMETADATA);
      }

      Settings emailSettings =
          new Settings()
              .withConfigType(SettingsType.EMAIL_CONFIGURATION)
              .withConfigValue(smtpSettings);

      Entity.getSystemRepository().createOrUpdate(emailSettings);

      LOG.info(
          "Email settings updated. (Email Entity: {}, SMTP Enabled: {}, SMTP Host: {})",
          emailingEntity,
          enableSmtpServer,
          serverEndpoint);
      return 0;

    } catch (Exception e) {
      LOG.error("Failed to configure email settings due to: ", e);
      return 1;
    }
  }

  @Command(name = "install-app", description = "Install the application from App MarketPlace.")
  public Integer installApp(
      @Option(
              names = {"-n", "--name"},
              description = "The name of the application to install.",
              required = true)
          String appName,
      @Option(
              names = {"--force"},
              description = "Forces migrations to be run again, even if they have ran previously",
              defaultValue = "false")
          boolean force) {
    try {
      parseConfig();
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

      if (!force && isAppInstalled(appRepository, appName)) {
        LOG.info("App already installed.");
        return 0;
      }

      if (force && deleteApplication(appRepository, appName)) {
        LOG.info("App deleted.");
      }

      LOG.info("App not installed. Installing...");
      installApplication(appName, appRepository);
      LOG.info("App Installed.");
      return 0;
    } catch (Exception e) {
      LOG.error("Install Application Failed", e);
      return 1;
    }
  }

  @Command(name = "delete-app", description = "Delete the installed application.")
  public Integer deleteApp(
      @Option(
              names = {"-n", "--name"},
              description = "The name of the application to install.",
              required = true)
          String appName) {
    try {
      parseConfig();
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      if (deleteApplication(appRepository, appName)) {
        LOG.info("App deleted.");
      }
      return 0;
    } catch (Exception e) {
      LOG.error("Delete Application Failed", e);
      return 1;
    }
  }

  @Command(
      name = "create-user",
      description = "Creates a new user when basic authentication is enabled.")
  public Integer createUser(
      @Option(
              names = {"-u", "--user"},
              description = "User email address",
              required = true)
          String email,
      @Option(
              names = {"-p", "--password"},
              description = "User password",
              interactive = true,
              arity = "0..1",
              required = true)
          char[] password,
      @Option(
              names = {"--admin"},
              description = "Promote the user as an admin",
              defaultValue = "false")
          boolean admin) {
    try {
      LOG.info("Creating user: {}", email);
      if (nullOrEmpty(password)) {
        throw new IllegalArgumentException("Password cannot be empty.");
      }
      if (nullOrEmpty(email)
          || !email.matches("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
        throw new IllegalArgumentException("Invalid email address: " + email);
      }
      parseConfig();
      AuthProvider authProvider = config.getAuthenticationConfiguration().getProvider();
      if (!authProvider.equals(AuthProvider.BASIC)) {
        LOG.error("Authentication is not set to basic. User creation is not supported.");
        return 1;
      }
      initializeCollectionRegistry();
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      try {
        userRepository.getByEmail(null, email, EntityUtil.Fields.EMPTY_FIELDS);
        LOG.error("User {} already exists.", email);
        return 1;
      } catch (EntityNotFoundException ex) {
        // Expected – continue to create the user.
      }
      initOrganization();
      String domain = email.substring(email.indexOf("@") + 1);
      String username = email.substring(0, email.indexOf("@"));
      UserUtil.createOrUpdateUser(authProvider, username, new String(password), domain, admin);
      LOG.info("User {} created successfully. Admin: {}", email, admin);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to create user: {}", email, e);
      return 1;
    }
  }

  private void initializeCollectionRegistry() {
    LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
    ch.qos.logback.classic.Logger rootLogger =
        loggerContext.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    Level originalLevel = rootLogger.getLevel();

    try {
      rootLogger.setLevel(Level.ERROR);
      CollectionRegistry.initialize();
    } finally {
      // Restore the original logging level.
      rootLogger.setLevel(originalLevel);
    }
  }

  private boolean isAppInstalled(AppRepository appRepository, String appName) {
    try {
      appRepository.findByName(appName, Include.NON_DELETED);
      return true;
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private boolean deleteApplication(AppRepository appRepository, String appName) {
    try {
      appRepository.deleteByName(ADMIN_USER_NAME, appName, true, true);
      return true;
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private void installApplication(String appName, AppRepository appRepository) throws Exception {
    PipelineServiceClientInterface pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());

    JWTTokenGenerator.getInstance()
        .init(
            config.getAuthenticationConfiguration().getTokenValidationAlgorithm(),
            config.getJwtTokenConfiguration());

    AppMarketPlaceMapper mapper = new AppMarketPlaceMapper(pipelineServiceClient);
    AppMarketPlaceRepository appMarketRepository =
        (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);

    AppMarketPlaceUtil.createAppMarketPlaceDefinitions(appMarketRepository, mapper);

    AppMarketPlaceDefinition definition =
        appMarketRepository.getByName(null, appName, appMarketRepository.getFields("id"));

    CreateApp createApp =
        new CreateApp()
            .withName(definition.getName())
            .withDescription(definition.getDescription())
            .withDisplayName(definition.getDisplayName())
            .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE))
            .withAppConfiguration(new AppConfiguration());

    AppMapper appMapper = new AppMapper();
    App entity = appMapper.createToEntity(createApp, ADMIN_USER_NAME);
    appRepository.prepareInternal(entity, true);
    appRepository.createOrUpdate(null, entity);
  }

  @Command(
      name = "check-connection",
      description =
          "Checks if a connection can be successfully " + "obtained for the target database")
  public Integer checkConnection() {
    try {
      parseConfig();
      flyway.getConfiguration().getDataSource().getConnection();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to check connection due to ", e);
      return 1;
    }
  }

  @Command(
      name = "drop-create",
      description =
          "Deletes any tables in configured database and creates a new tables "
              + "based on current version of OpenMetadata. This command also re-creates the search indexes.")
  public Integer dropCreate() {
    try {
      promptUserForDelete();
      parseConfig();
      LOG.info("Deleting all the OpenMetadata tables.");
      flyway.clean();
      LOG.info("Creating the OpenMetadata Schema.");
      flyway.migrate();
      LOG.info("Running the Native Migrations.");
      validateAndRunSystemDataMigrations(true);
      LOG.info("OpenMetadata Database Schema is Updated.");
      LOG.info("create indexes.");
      searchRepository.createIndexes();
      Entity.cleanup();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to drop create due to ", e);
      return 1;
    }
  }

  @Command(name = "reset-password", description = "Reset the password for a user.")
  public Integer resetUserPassword(
      @Option(
              names = {"-e", "--email"},
              description = "Email for which to reset the password.",
              required = true)
          String email,
      @Option(
              names = {"-p", "--password"},
              description = "Enter user password",
              arity = "0..1",
              interactive = true,
              required = true)
          char[] password) {
    try {
      LOG.info("Resetting password for user : {}", email);
      if (nullOrEmpty(password)) {
        throw new IllegalArgumentException("Password cannot be empty.");
      }
      parseConfig();
      CollectionRegistry.initialize();

      AuthProvider authProvider = config.getAuthenticationConfiguration().getProvider();

      // Only Basic Auth provider is supported for password reset
      if (!authProvider.equals(AuthProvider.BASIC)) {
        LOG.error("Auth Provider is Not Basic. Cannot apply Password");
        return 1;
      }

      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      Set<String> fieldList = new HashSet<>(userRepository.getPatchFields().getFieldList());
      fieldList.add(AUTH_MECHANISM_FIELD);
      User originalUser = userRepository.getByEmail(null, email, new EntityUtil.Fields(fieldList));

      // Check if the user is a bot user
      if (Boolean.TRUE.equals(originalUser.getIsBot())) {
        LOG.error("Bot user : {} cannot have password.", originalUser.getName());
        return 1;
      }

      User updatedUser = JsonUtils.deepCopy(originalUser, User.class);
      String inputPwd = new String(password);
      updateUserWithHashedPwd(updatedUser, inputPwd);
      UserUtil.addOrUpdateUser(updatedUser);
      LOG.info("Password updated successfully.");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to reset user password.", e);
      return 1;
    }
  }

  @Command(
      name = "migrate",
      description = "Migrates the OpenMetadata database schema and search index mappings.")
  public Integer migrate(
      @Option(
              names = {"--force"},
              description = "Forces migrations to be run again, even if they have ran previously",
              defaultValue = "false")
          boolean force) {
    try {
      LOG.info("Migrating the OpenMetadata Schema.");
      parseConfig();
      flyway.migrate();
      validateAndRunSystemDataMigrations(force);
      LOG.info("Update Search Indexes.");
      searchRepository.updateIndexes();
      printChangeLog();
      // update entities secrets if required
      new SecretsManagerUpdateService(secretsManager, config.getClusterName()).updateEntities();
      Entity.cleanup();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to db migration due to ", e);
      return 1;
    }
  }

  @Command(name = "changelog", description = "Prints the change log of database migration.")
  public Integer changelog() {
    try {
      parseConfig();
      printChangeLog();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to fetch db change log due to ", e);
      return 1;
    }
  }

  @Command(name = "reindex", description = "Re Indexes data into search engine from command line.")
  public Integer reIndex(
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "300",
              description = "Number of records to process in each batch.")
          int batchSize,
      @Option(
              names = {"-p", "--payload-size"},
              defaultValue = "104857600",
              description = "Maximum size of the payload in bytes.")
          long payloadSize,
      @Option(
              names = {"--recreate-indexes"},
              defaultValue = "true",
              description = "Flag to determine if indexes should be recreated.")
          boolean recreateIndexes,
      @Option(
              names = {"--producer-threads"},
              defaultValue = "10",
              description = "Number of threads to use for processing.")
          int producerThreads,
      @Option(
              names = {"--consumer-threads"},
              defaultValue = "5",
              description = "Number of threads to use for processing.")
          int consumerThreads,
      @Option(
              names = {"--queue-size"},
              defaultValue = "300",
              description = "Queue Size to use internally for reindexing.")
          int queueSize,
      @Option(
              names = {"--back-off"},
              defaultValue = "1000",
              description = "Back-off time in milliseconds for retries.")
          int backOff,
      @Option(
              names = {"--max-back-off"},
              defaultValue = "10000",
              description = "Max Back-off time in milliseconds for retries.")
          int maxBackOff,
      @Option(
              names = {"--max-requests"},
              defaultValue = "1000",
              description = "Maximum number of concurrent search requests.")
          int maxRequests,
      @Option(
              names = {"--retries"},
              defaultValue = "3",
              description = "Maximum number of retries for failed search requests.")
          int retries,
      @Option(
              names = {"--entities"},
              defaultValue = "'all'",
              description =
                  "Entities to reindex. Passing --entities='table,dashboard' will reindex table and dashboard entities. Passing nothing will reindex everything.")
          String entityStr) {
    try {
      LOG.info(
          "Running Reindexing with Entities:{} , Batch Size: {}, Payload Size: {}, Recreate-Index: {}, Producer threads: {}, Consumer threads: {}, Queue Size: {}, Back-off: {}, Max Back-off: {}, Max Requests: {}, Retries: {}",
          entityStr,
          batchSize,
          payloadSize,
          recreateIndexes,
          producerThreads,
          consumerThreads,
          queueSize,
          backOff,
          maxBackOff,
          maxRequests,
          retries);
      parseConfig();
      CollectionRegistry.initialize();
      ApplicationHandler.initialize(config);
      CollectionRegistry.getInstance().loadSeedData(jdbi, config, null, null, null, true);
      ApplicationHandler.initialize(config);
      TypeRepository typeRepository = (TypeRepository) Entity.getEntityRepository(Entity.TYPE);
      TypeRegistry.instance().initialize(typeRepository);
      AppScheduler.initialize(config, collectionDAO, searchRepository);
      String appName = "SearchIndexingApplication";
      Set<String> entities =
          new HashSet<>(Arrays.asList(entityStr.substring(1, entityStr.length() - 1).split(",")));
      return executeSearchReindexApp(
          appName,
          entities,
          batchSize,
          payloadSize,
          recreateIndexes,
          producerThreads,
          consumerThreads,
          queueSize,
          backOff,
          maxBackOff,
          maxRequests,
          retries);
    } catch (Exception e) {
      LOG.error("Failed to reindex due to ", e);
      return 1;
    }
  }

  @Command(name = "syncAlertOffset", description = "Sync the Alert Offset.")
  public Integer reIndex(
      @Option(
              names = {"-n", "--name"},
              description = "Name of the alerts.",
              required = true)
          String alertName) {
    try {
      parseConfig();
      CollectionRegistry.initialize();
      EventSubscriptionRepository repository =
          (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
      repository.syncEventSubscriptionOffset(alertName);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to sync alert offset due to ", e);
      return 1;
    }
  }

  private int executeSearchReindexApp(
      String appName,
      Set<String> entities,
      int batchSize,
      long payloadSize,
      boolean recreateIndexes,
      int producerThreads,
      int consumerThreads,
      int queueSize,
      int backOff,
      int maxBackOff,
      int maxRequests,
      int retries) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App originalSearchIndexApp =
        appRepository.getByName(null, appName, appRepository.getFields("id"));

    EventPublisherJob storedJob =
        JsonUtils.convertValue(
            originalSearchIndexApp.getAppConfiguration(), EventPublisherJob.class);

    EventPublisherJob updatedJob = JsonUtils.deepCopy(storedJob, EventPublisherJob.class);
    updatedJob
        .withEntities(entities)
        .withBatchSize(batchSize)
        .withPayLoadSize(payloadSize)
        .withRecreateIndex(recreateIndexes)
        .withProducerThreads(producerThreads)
        .withConsumerThreads(consumerThreads)
        .withQueueSize(queueSize)
        .withInitialBackoff(backOff)
        .withMaxBackoff(maxBackOff)
        .withMaxConcurrentRequests(maxRequests)
        .withMaxRetries(retries);

    // Update the search index app with the new configurations
    App updatedSearchIndexApp = JsonUtils.deepCopy(originalSearchIndexApp, App.class);
    updatedSearchIndexApp.withAppConfiguration(updatedJob);
    JsonPatch patch = JsonUtils.getJsonPatch(originalSearchIndexApp, updatedSearchIndexApp);

    appRepository.patch(null, originalSearchIndexApp.getId(), "admin", patch);

    // Trigger Application
    long currentTime = System.currentTimeMillis();
    AppScheduler.getInstance().triggerOnDemandApplication(updatedSearchIndexApp);

    int result = waitAndReturnReindexingAppStatus(updatedSearchIndexApp, currentTime);

    // Re-patch with original configuration
    JsonPatch repatch = JsonUtils.getJsonPatch(updatedSearchIndexApp, originalSearchIndexApp);
    appRepository.patch(null, originalSearchIndexApp.getId(), "admin", repatch);

    return result;
  }

  @Command(
      name = "reindexdi",
      description = "Re Indexes data insights into search engine from command line.")
  public Integer reIndexDI(
      @Option(
              names = {"-b", "--batch-size"},
              defaultValue = "100",
              description = "Number of records to process in each batch.")
          int batchSize,
      @Option(
              names = {"--recreate-indexes"},
              defaultValue = "true",
              description = "Flag to determine if indexes should be recreated.")
          boolean recreateIndexes,
      @Option(
              names = {"--start-date"},
              description = "Start Date to backfill from.")
          String startDate,
      @Option(
              names = {"--end-date"},
              description = "End Date to backfill to.")
          String endDate) {
    try {
      LOG.info(
          "Running Reindexing with Batch Size: {}, Recreate-Index: {}, Start Date: {}, End Date: {}.",
          batchSize,
          recreateIndexes,
          startDate,
          endDate);
      parseConfig();
      CollectionRegistry.initialize();
      ApplicationHandler.initialize(config);
      CollectionRegistry.getInstance().loadSeedData(jdbi, config, null, null, null, true);
      ApplicationHandler.initialize(config);
      AppScheduler.initialize(config, collectionDAO, searchRepository);
      return executeDataInsightsReindexApp(
          batchSize, recreateIndexes, getBackfillConfiguration(startDate, endDate));
    } catch (Exception e) {
      LOG.error("Failed to reindex due to ", e);
      return 1;
    }
  }

  private BackfillConfiguration getBackfillConfiguration(String startDate, String endDate) {
    BackfillConfiguration backfillConfiguration = new BackfillConfiguration();
    backfillConfiguration.withEnabled(false);

    if (startDate != null) {
      backfillConfiguration.withEnabled(true);
      backfillConfiguration.withStartDate(startDate);
      backfillConfiguration.withEndDate(
          Objects.requireNonNullElseGet(
              endDate, () -> timestampToString(System.currentTimeMillis(), "yyyy-MM-dd")));
    }
    return backfillConfiguration;
  }

  private int executeDataInsightsReindexApp(
      int batchSize, boolean recreateIndexes, BackfillConfiguration backfillConfiguration) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App originalDataInsightsApp =
        appRepository.getByName(null, "DataInsightsApplication", appRepository.getFields("id"));

    DataInsightsAppConfig storedConfig =
        JsonUtils.convertValue(
            originalDataInsightsApp.getAppConfiguration(), DataInsightsAppConfig.class);

    DataInsightsAppConfig updatedConfig =
        JsonUtils.deepCopy(storedConfig, DataInsightsAppConfig.class);
    updatedConfig
        .withBatchSize(batchSize)
        .withRecreateDataAssetsIndex(recreateIndexes)
        .withBackfillConfiguration(backfillConfiguration);

    // Update the data insights app with the new configurations
    App updatedDataInsightsApp = JsonUtils.deepCopy(originalDataInsightsApp, App.class);
    updatedDataInsightsApp.withAppConfiguration(updatedConfig);
    JsonPatch patch = JsonUtils.getJsonPatch(originalDataInsightsApp, updatedDataInsightsApp);

    appRepository.patch(null, originalDataInsightsApp.getId(), "admin", patch);

    // Trigger Application
    long currentTime = System.currentTimeMillis();
    AppScheduler.getInstance().triggerOnDemandApplication(updatedDataInsightsApp);

    int result = waitAndReturnReindexingAppStatus(updatedDataInsightsApp, currentTime);

    // Re-patch with original configuration
    JsonPatch repatch = JsonUtils.getJsonPatch(updatedDataInsightsApp, originalDataInsightsApp);
    appRepository.patch(null, originalDataInsightsApp.getId(), "admin", repatch);

    return result;
  }

  @SneakyThrows
  private int waitAndReturnReindexingAppStatus(App searchIndexApp, long startTime) {
    AppRunRecord appRunRecord = null;
    do {
      try {
        AppRepository appRepository =
            (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
        appRunRecord = appRepository.getLatestAppRunsAfterStartTime(searchIndexApp, startTime);
        if (isRunCompleted(appRunRecord)) {
          List<String> columns =
              new ArrayList<>(
                  List.of(
                      "jobStatus",
                      "startTime",
                      "endTime",
                      "executionTime",
                      "successContext",
                      "failureContext"));
          List<List<String>> rows = new ArrayList<>();

          String startTimeofJob =
              nullOrEmpty(appRunRecord.getStartTime())
                  ? "Unavailable"
                  : getDateStringEpochMilli(appRunRecord.getStartTime());
          String endTimeOfJob =
              nullOrEmpty(appRunRecord.getEndTime())
                  ? "Unavailable"
                  : getDateStringEpochMilli(appRunRecord.getEndTime());
          String executionTime =
              nullOrEmpty(appRunRecord.getExecutionTime())
                  ? "Unavailable"
                  : String.format("%d seconds", appRunRecord.getExecutionTime() / 1000);
          rows.add(
              Arrays.asList(
                  getValueOrUnavailable(appRunRecord.getStatus().value()),
                  getValueOrUnavailable(startTimeofJob),
                  getValueOrUnavailable(endTimeOfJob),
                  getValueOrUnavailable(executionTime),
                  getValueOrUnavailable(appRunRecord.getSuccessContext()),
                  getValueOrUnavailable(appRunRecord.getFailureContext())));
          printToAsciiTable(columns, rows, "Failed to run Search Reindexing");
        }
      } catch (Exception ignored) {
      }
      LOG.info(
          "[Reindexing] Current Available Status : {}. Reindexing is still, waiting for 10 seconds to fetch the latest status again.",
          JsonUtils.pojoToJson(appRunRecord));
      Thread.sleep(10000);
    } while (!isRunCompleted(appRunRecord));

    if (appRunRecord.getStatus().equals(AppRunRecord.Status.SUCCESS)
        || appRunRecord.getStatus().equals(AppRunRecord.Status.COMPLETED)) {
      LOG.debug("Reindexing Completed Successfully.");
      return 0;
    }
    LOG.error("Reindexing completed in Failure.");
    return 1;
  }

  public String getValueOrUnavailable(Object obj) {
    return nullOrEmpty(obj) ? "Unavailable" : JsonUtils.pojoToJson(obj);
  }

  boolean isRunCompleted(AppRunRecord appRunRecord) {
    if (appRunRecord == null) {
      return false;
    }

    return !nullOrEmpty(appRunRecord.getExecutionTime());
  }

  @Command(name = "deploy-pipelines", description = "Deploy all the service pipelines.")
  public Integer deployPipelines() {
    try {
      LOG.info("Deploying Pipelines");
      parseConfig();
      PipelineServiceClientInterface pipelineServiceClient =
          PipelineServiceClientFactory.createPipelineServiceClient(
              config.getPipelineServiceClientConfiguration());
      IngestionPipelineRepository pipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      List<IngestionPipeline> pipelines =
          pipelineRepository.listAll(
              new EntityUtil.Fields(Set.of(FIELD_OWNERS, "service")),
              new ListFilter(Include.NON_DELETED));
      LOG.debug(String.format("Pipelines %d", pipelines.size()));
      List<String> columns = Arrays.asList("Name", "Type", "Service Name", "Status");
      List<List<String>> pipelineStatuses = new ArrayList<>();
      for (IngestionPipeline pipeline : pipelines) {
        deployPipeline(pipeline, pipelineServiceClient, pipelineStatuses);
      }
      printToAsciiTable(columns, pipelineStatuses, "No Pipelines Found");
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to deploy pipelines due to ", e);
      return 1;
    }
  }

  @Command(
      name = "migrate-secrets",
      description =
          "Migrate secrets from DB to the configured Secrets Manager. "
              + "Note that this does not support migrating between external Secrets Managers")
  public Integer migrateSecrets() {
    try {
      LOG.info("Migrating Secrets from DB...");
      parseConfig();
      // update entities secrets if required
      new SecretsManagerUpdateService(secretsManager, config.getClusterName()).updateEntities();
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to migrate secrets due to ", e);
      return 1;
    }
  }

  @Command(
      name = "analyze-tables",
      description =
          "Migrate secrets from DB to the configured Secrets Manager. "
              + "Note that this does not support migrating between external Secrets Managers")
  public Integer analyzeTables() {
    try {
      LOG.info("Analyzing Tables...");
      parseConfig();
      Entity.getEntityList().forEach(this::analyzeEntityTable);
      return 0;
    } catch (Exception e) {
      LOG.error("Failed to analyze tables due to ", e);
      return 1;
    }
  }

  private void analyzeEntityTable(String entity) {
    try {
      EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entity);
      LOG.info("Analyzing table for [{}] Entity", entity);
      repository.getDao().analyzeTable();
    } catch (EntityNotFoundException e) {
      LOG.debug("No repository for [{}] Entity", entity);
    }
  }

  private void deployPipeline(
      IngestionPipeline pipeline,
      PipelineServiceClientInterface pipelineServiceClient,
      List<List<String>> pipelineStatuses) {
    try {
      LOG.debug(String.format("deploying pipeline %s", pipeline.getName()));
      pipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(config, pipeline).build());
      secretsManager.decryptIngestionPipeline(pipeline);
      ServiceEntityInterface service =
          Entity.getEntity(pipeline.getService(), "", Include.NON_DELETED);
      pipelineServiceClient.deployPipeline(pipeline, service);
    } catch (Exception e) {
      LOG.error(
          String.format(
              "Failed to deploy pipeline %s of type %s for service %s",
              pipeline.getName(),
              pipeline.getPipelineType().value(),
              pipeline.getService().getName()),
          e);
      pipeline.setDeployed(false);
    } finally {
      LOG.debug("update the pipeline");
      collectionDAO.ingestionPipelineDAO().update(pipeline);
      pipelineStatuses.add(
          Arrays.asList(
              pipeline.getName(),
              pipeline.getPipelineType().value(),
              pipeline.getService().getName(),
              pipeline.getDeployed().toString()));
    }
  }

  private void parseConfig() throws Exception {
    if (debug) {
      Logger root = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
      root.setLevel(Level.DEBUG);
    }
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config =
        factory.build(
            new SubstitutingSourceProvider(
                new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
            configFilePath);
    Fernet.getInstance().setFernetKey(config);
    DataSourceFactory dataSourceFactory = config.getDataSourceFactory();
    if (dataSourceFactory == null) {
      throw new IllegalArgumentException("No database in config file");
    }
    // Check for db auth providers.
    DatabaseAuthenticationProviderFactory.get(dataSourceFactory.getUrl())
        .ifPresent(
            databaseAuthenticationProvider -> {
              String token =
                  databaseAuthenticationProvider.authenticate(
                      dataSourceFactory.getUrl(),
                      dataSourceFactory.getUser(),
                      dataSourceFactory.getPassword());
              dataSourceFactory.setPassword(token);
            });

    String jdbcUrl = dataSourceFactory.getUrl();
    String user = dataSourceFactory.getUser();
    String password = dataSourceFactory.getPassword();
    assert user != null && password != null;
    String flywayRootPath = config.getMigrationConfiguration().getFlywayPath();
    String location =
        "filesystem:"
            + flywayRootPath
            + File.separator
            + config.getDataSourceFactory().getDriverClass();
    flyway =
        Flyway.configure()
            .encoding(StandardCharsets.UTF_8)
            .table("DATABASE_CHANGE_LOG")
            .sqlMigrationPrefix("v")
            .validateOnMigrate(false)
            .outOfOrder(false)
            .baselineOnMigrate(true)
            .baselineVersion(MigrationVersion.fromVersion("000"))
            .cleanOnValidationError(false)
            .locations(location)
            .dataSource(jdbcUrl, user, password)
            .cleanDisabled(false)
            .load();
    nativeSQLScriptRootPath = config.getMigrationConfiguration().getNativePath();
    extensionSQLScriptRootPath = config.getMigrationConfiguration().getExtensionPath();

    jdbi = JdbiUtils.createAndSetupJDBI(dataSourceFactory);

    searchRepository = new SearchRepository(config.getElasticSearchConfiguration());

    // Initialize secrets manager
    secretsManager =
        SecretsManagerFactory.createSecretsManager(
            config.getSecretsManagerConfiguration(), config.getClusterName());

    collectionDAO = jdbi.onDemand(CollectionDAO.class);
    Entity.setSearchRepository(searchRepository);
    Entity.setCollectionDAO(collectionDAO);
    Entity.setSystemRepository(new SystemRepository());
    Entity.initializeRepositories(config, jdbi);
  }

  private void promptUserForDelete() {
    LOG.info(
        """
                    You are about drop all the data in the database. ALL METADATA WILL BE DELETED.\s
                    This is not recommended for a Production setup or any deployment where you have collected\s
                    a lot of information from the users, such as descriptions, tags, etc.
                    """);
    String input = "";
    Scanner scanner = new Scanner(System.in);
    while (!input.equals("DELETE")) {
      LOG.info("Enter QUIT to quit. If you still want to continue, please enter DELETE: ");
      input = scanner.next();
      if (input.equals("QUIT")) {
        LOG.info("Exiting without deleting data");
        System.exit(1);
      }
    }
  }

  private void validateAndRunSystemDataMigrations(boolean force) {
    ConnectionType connType = ConnectionType.from(config.getDataSourceFactory().getDriverClass());
    DatasourceConfig.initialize(connType.label);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeSQLScriptRootPath,
            connType,
            extensionSQLScriptRootPath,
            config.getPipelineServiceClientConfiguration(),
            config.getAuthenticationConfiguration(),
            force);
    workflow.loadMigrations();
    workflow.printMigrationInfo();
    workflow.runMigrationWorkflows();
  }

  private void initOrganization() {
    LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
    ch.qos.logback.classic.Logger rootLogger =
        loggerContext.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    Level originalLevel = rootLogger.getLevel();
    TeamRepository teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    try {
      teamRepository.getByName(null, ORGANIZATION_NAME, EntityUtil.Fields.EMPTY_FIELDS);
    } catch (EntityNotFoundException e) {
      try {
        PolicyRepository policyRepository =
            (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
        policyRepository.initSeedDataFromResources();
        RoleRepository roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
        List<Role> roles = roleRepository.getEntitiesFromSeedData();
        for (Role role : roles) {
          role.setFullyQualifiedName(role.getName());
          List<EntityReference> policies = role.getPolicies();
          for (EntityReference policy : policies) {
            EntityReference ref =
                Entity.getEntityReferenceByName(
                    Entity.POLICY, policy.getName(), Include.NON_DELETED);
            policy.setId(ref.getId());
          }
          roleRepository.initializeEntity(role);
        }
        teamRepository.initOrganization();
      } catch (Exception ex) {
        LOG.error("Failed to initialize organization due to ", ex);
        throw new RuntimeException(ex);
      } finally {
        rootLogger.setLevel(originalLevel);
      }
    }
  }

  public static void printToAsciiTable(
      List<String> columns, List<List<String>> rows, String emptyText) {
    LOG.info(new AsciiTable(columns, rows, true, "", emptyText).render());
  }

  private void printChangeLog() {
    MigrationDAO migrationDAO = jdbi.onDemand(MigrationDAO.class);
    List<MigrationDAO.ServerChangeLog> serverChangeLogs =
        migrationDAO.listMetricsFromDBMigrations();
    Set<String> columns = new LinkedHashSet<>(Set.of("version", "installedOn"));
    List<List<String>> rows = new ArrayList<>();
    try {
      for (MigrationDAO.ServerChangeLog serverChangeLog : serverChangeLogs) {
        List<String> row = new ArrayList<>();
        if (serverChangeLog.getMetrics() != null) {
          JsonObject metricsJson =
              new Gson().fromJson(serverChangeLog.getMetrics(), JsonObject.class);
          Set<String> keys = metricsJson.keySet();
          columns.addAll(keys);
          row.add(serverChangeLog.getVersion());
          row.add(serverChangeLog.getInstalledOn());
          row.addAll(
              metricsJson.entrySet().stream()
                  .map(Map.Entry::getValue)
                  .map(JsonElement::toString)
                  .toList());
          rows.add(row);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to generate migration metrics due to", e);
    }
    printToAsciiTable(columns.stream().toList(), rows, "No Server Change log found");
  }

  public static void main(String... args) {
    LOG.info(printOpenMetadataText());
    int exitCode =
        new CommandLine(new org.openmetadata.service.util.OpenMetadataOperations()).execute(args);
    System.exit(exitCode);
  }
}
