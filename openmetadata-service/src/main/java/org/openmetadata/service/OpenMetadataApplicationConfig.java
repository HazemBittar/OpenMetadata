/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.Configuration;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.health.conf.HealthConfiguration;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;
import java.util.Map;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.api.configuration.dataQuality.DataQualityConfiguration;
import org.openmetadata.schema.api.configuration.events.EventHandlerConfiguration;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.fernet.FernetConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.configuration.LimitsConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.migration.MigrationConfiguration;
import org.openmetadata.service.monitoring.EventMonitorConfiguration;
import org.openmetadata.service.util.JsonUtils;

@Getter
@Setter
public class OpenMetadataApplicationConfig extends Configuration {
  @JsonProperty("database")
  @NotNull
  @Valid
  private DataSourceFactory dataSourceFactory;

  @JsonProperty("swagger")
  private SwaggerBundleConfiguration swaggerBundleConfig;

  @JsonProperty("authorizerConfiguration")
  private AuthorizerConfiguration authorizerConfiguration;

  @JsonProperty("authenticationConfiguration")
  private AuthenticationConfiguration authenticationConfiguration;

  @JsonProperty("jwtTokenConfiguration")
  private JWTTokenConfiguration jwtTokenConfiguration;

  @JsonProperty("elasticsearch")
  private ElasticSearchConfiguration elasticSearchConfiguration;

  @JsonProperty("eventHandlerConfiguration")
  private EventHandlerConfiguration eventHandlerConfiguration;

  @JsonProperty("pipelineServiceClientConfiguration")
  private PipelineServiceClientConfiguration pipelineServiceClientConfiguration;

  private static final String CERTIFICATE_PATH = "certificatePath";

  public PipelineServiceClientConfiguration getPipelineServiceClientConfiguration() {
    if (pipelineServiceClientConfiguration != null) {
      Map<String, String> temporarySSLConfig =
          JsonUtils.readOrConvertValue(
              pipelineServiceClientConfiguration.getSslConfig(), Map.class);
      if (temporarySSLConfig != null && temporarySSLConfig.containsKey(CERTIFICATE_PATH)) {
        temporarySSLConfig.put("caCertificate", temporarySSLConfig.get(CERTIFICATE_PATH));
        temporarySSLConfig.remove(CERTIFICATE_PATH);
      }
      pipelineServiceClientConfiguration.setSslConfig(temporarySSLConfig);
    }
    return pipelineServiceClientConfiguration;
  }

  @JsonProperty("migrationConfiguration")
  @NotNull
  private MigrationConfiguration migrationConfiguration;

  @JsonProperty("fernetConfiguration")
  private FernetConfiguration fernetConfiguration;

  @JsonProperty("health")
  @NotNull
  @Valid
  private HealthConfiguration healthConfiguration = new HealthConfiguration();

  @JsonProperty("secretsManagerConfiguration")
  private SecretsManagerConfiguration secretsManagerConfiguration;

  @JsonProperty("eventMonitoringConfiguration")
  private EventMonitorConfiguration eventMonitorConfiguration;

  @JsonProperty("clusterName")
  private String clusterName;

  @Valid
  @NotNull
  @JsonProperty("web")
  private OMWebConfiguration webConfiguration = new OMWebConfiguration();

  @JsonProperty("dataQualityConfiguration")
  private DataQualityConfiguration dataQualityConfiguration;

  @JsonProperty("limits")
  private LimitsConfiguration limitsConfiguration;

  @Override
  public String toString() {
    return "catalogConfig{"
        + ", dataSourceFactory="
        + dataSourceFactory
        + ", swaggerBundleConfig="
        + swaggerBundleConfig
        + ", authorizerConfiguration="
        + authorizerConfiguration
        + '}';
  }
}
