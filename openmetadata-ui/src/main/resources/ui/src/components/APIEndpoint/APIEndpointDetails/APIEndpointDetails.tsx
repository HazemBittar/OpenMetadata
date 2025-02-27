/*
 *  Copyright 2022 Collate.
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { PageType } from '../../../generated/system/ui/page';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreApiEndPoint } from '../../../rest/apiEndpointsAPI';
import apiEndpointClassBase from '../../../utils/APIEndpoints/APIEndpointClassBase';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { APIEndpointDetailsProps } from './APIEndpointDetails.interface';

const APIEndpointDetails: React.FC<APIEndpointDetailsProps> = ({
  apiEndpointDetails,
  apiEndpointPermissions,
  fetchAPIEndpointDetails,
  onFollowApiEndPoint,
  onApiEndpointUpdate,
  onToggleDelete,
  onUnFollowApiEndPoint,
  onUpdateApiEndpointDetails,
  onVersionChange,
  onUpdateVote,
}: APIEndpointDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedApiEndpointFqn } = useFqn();
  const history = useHistory();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { customizedPage } = useCustomPages(PageType.APIEndpoint);

  const {
    owners,
    deleted,
    followers = [],
  } = useMemo(
    () => ({
      ...apiEndpointDetails,
      tier: getTierTags(apiEndpointDetails.tags ?? []),
      apiEndpointTags: getTagsWithoutTier(apiEndpointDetails.tags ?? []),
      entityName: getEntityName(apiEndpointDetails),
    }),
    [apiEndpointDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followApiEndpoint = async () =>
    isFollowing ? await onUnFollowApiEndPoint() : await onFollowApiEndPoint();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...apiEndpointDetails,
      displayName: data.displayName,
    };
    await onApiEndpointUpdate(updatedData, 'displayName');
  };

  const handleRestoreApiEndpoint = async () => {
    try {
      const { version: newVersion } = await restoreApiEndPoint(
        apiEndpointDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.api-endpoint'),
        }),
        2000
      );
      onToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.api-endpoint'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(
          EntityType.API_ENDPOINT,
          decodedApiEndpointFqn,
          activeKey
        )
      );
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwners?: APIEndpoint['owners']) => {
      const updatedApiEndpointDetails = {
        ...apiEndpointDetails,
        owners: newOwners,
      };
      await onApiEndpointUpdate(updatedApiEndpointDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(apiEndpointDetails?.tags ?? [], newTier);
    const updatedApiEndpointDetails = {
      ...apiEndpointDetails,
      tags: tierTag,
    };

    return onApiEndpointUpdate(updatedApiEndpointDetails, 'tags');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(
      EntityType.API_ENDPOINT,
      decodedApiEndpointFqn,
      handleFeedCount
    );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? onToggleDelete(version) : history.push('/'),
    []
  );

  const {
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editCustomAttributePermission:
        (apiEndpointPermissions.EditAll ||
          apiEndpointPermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (apiEndpointPermissions.EditAll ||
          apiEndpointPermissions.EditLineage) &&
        !deleted,
      viewAllPermission: apiEndpointPermissions.ViewAll,
    }),
    [apiEndpointPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [apiEndpointPermissions, decodedApiEndpointFqn]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);
    const tabs = apiEndpointClassBase.getAPIEndpointDetailPageTabs({
      activeTab,
      feedCount,
      apiEndpoint: apiEndpointDetails,
      fetchAPIEndpointDetails,
      getEntityFeedCount,
      labelMap: tabLabelMap,
      handleFeedCount,
      editCustomAttributePermission,
      viewAllPermission,
      editLineagePermission,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.SCHEMA
    );
  }, [
    activeTab,
    feedCount,
    apiEndpointDetails,
    fetchAPIEndpointDetails,
    getEntityFeedCount,
    handleFeedCount,
    editCustomAttributePermission,
    viewAllPermission,
    editLineagePermission,
  ]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.api-endpoint'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={onUpdateApiEndpointDetails}
            dataAsset={apiEndpointDetails}
            entityType={EntityType.API_ENDPOINT}
            openTaskCount={feedCount.openTaskCount}
            permissions={apiEndpointPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followApiEndpoint}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreApiEndpoint}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={onVersionChange}
          />
        </Col>
        <GenericProvider<APIEndpoint>
          data={apiEndpointDetails}
          permissions={apiEndpointPermissions}
          type={EntityType.API_ENDPOINT}
          onUpdate={onApiEndpointUpdate}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.SCHEMA}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>
      <LimitWrapper resource="apiEndpoint">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<APIEndpointDetailsProps>(APIEndpointDetails);
