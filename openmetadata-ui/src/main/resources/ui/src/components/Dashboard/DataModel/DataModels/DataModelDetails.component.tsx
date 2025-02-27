/*
 *  Copyright 2023 Collate.
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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined, toString } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getEntityDetailsPath,
  getVersionPath,
} from '../../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../../constants/entity.constants';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { DashboardDataModel } from '../../../../generated/entity/data/dashboardDataModel';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomPages } from '../../../../hooks/useCustomPages';
import { useFqn } from '../../../../hooks/useFqn';
import { FeedCounts } from '../../../../interface/feed.interface';
import { restoreDataModel } from '../../../../rest/dataModelsAPI';
import { getFeedCounts } from '../../../../utils/CommonUtils';
import {
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../../utils/CustomizePage/CustomizePageUtils';
import { getDashboardDataModelDetailPageTabs } from '../../../../utils/DashboardDataModelUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { withActivityFeed } from '../../../AppRouter/withActivityFeed';
import { GenericProvider } from '../../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { DataModelDetailsProps } from './DataModelDetails.interface';

const DataModelDetails = ({
  updateDataModelDetailsState,
  dataModelData,
  dataModelPermissions,
  fetchDataModel,
  handleFollowDataModel,
  handleUpdateOwner,
  handleUpdateTier,
  onUpdateDataModel,
  handleToggleDelete,
  onUpdateVote,
}: DataModelDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab: activeTab } = useParams<{ tab: EntityTabs }>();
  const { fqn: decodedDataModelFQN } = useFqn();
  const { customizedPage } = useCustomPages(PageType.DashboardDataModel);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const { deleted, version } = useMemo(() => {
    return {
      deleted: dataModelData?.deleted,
      version: dataModelData?.version,
    };
  }, [dataModelData]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DASHBOARD_DATA_MODEL,
      decodedDataModelFQN,
      handleFeedCount
    );
  };

  useEffect(() => {
    decodedDataModelFQN && getEntityFeedCount();
  }, [decodedDataModelFQN]);

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(dataModelData)) {
      return;
    }

    const updatedData = {
      ...dataModelData,
      displayName: data.displayName,
    };

    await onUpdateDataModel(updatedData, 'displayName');
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(
        EntityType.DASHBOARD_DATA_MODEL,
        decodedDataModelFQN,
        toString(version)
      )
    );
  };

  const handleTabChange = (tabValue: EntityTabs) => {
    if (tabValue !== activeTab) {
      history.push({
        pathname: getEntityDetailsPath(
          EntityType.DASHBOARD_DATA_MODEL,
          decodedDataModelFQN,
          tabValue
        ),
      });
    }
  };

  const handleRestoreDataModel = async () => {
    try {
      const { version: newVersion } = await restoreDataModel(
        dataModelData.id ?? ''
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.data-model'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.data-model'),
        })
      );
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const { editLineagePermission } = useMemo(() => {
    return {
      editLineagePermission:
        (dataModelPermissions.EditAll || dataModelPermissions.EditLineage) &&
        !deleted,
    };
  }, [dataModelPermissions, deleted]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);
    const allTabs = getDashboardDataModelDetailPageTabs({
      feedCount,
      activeTab,
      handleFeedCount,
      editLineagePermission,
      dataModelData,
      dataModelPermissions,
      deleted: deleted ?? false,
      getEntityFeedCount,
      fetchDataModel,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      allTabs,
      customizedPage?.tabs,
      EntityTabs.TASKS
    );
  }, [
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    dataModelData?.sql,
    deleted,
    handleFeedCount,
    editLineagePermission,
  ]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.data-model'),
      })}
      title="Data Model Details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDataModelDetailsState}
            dataAsset={dataModelData}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            openTaskCount={feedCount.openTaskCount}
            permissions={dataModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowDataModel}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreDataModel}
            onTierUpdate={handleUpdateTier}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<DashboardDataModel>
          data={dataModelData}
          permissions={dataModelPermissions}
          type={EntityType.DASHBOARD_DATA_MODEL}
          onUpdate={onUpdateDataModel}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.MODEL}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={(activeKey: string) =>
                handleTabChange(activeKey as EntityTabs)
              }
            />
          </Col>
        </GenericProvider>
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed<DataModelDetailsProps>(DataModelDetails);
