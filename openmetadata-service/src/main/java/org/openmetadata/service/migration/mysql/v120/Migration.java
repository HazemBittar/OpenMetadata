package org.openmetadata.service.migration.mysql.v120;

import static org.openmetadata.service.migration.utils.v120.MigrationUtil.addQueryService;
import static org.openmetadata.service.migration.utils.v120.MigrationUtil.updateGlossaryAndGlossaryTermRelations;

import java.util.List;
import lombok.SneakyThrows;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.context.MigrationOps;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {
  private CollectionDAO collectionDAO;

  private Handle handle;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void initialize(Handle handle) {
    super.initialize(handle);
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    addQueryService(handle, collectionDAO);
    updateGlossaryAndGlossaryTermRelations(handle, collectionDAO);
  }

  @Override
  public List<MigrationOps> getMigrationOps() {
    return List.of(new MigrationOps("queryCount", "SELECT COUNT(*) FROM query_entity"));
  }
}
