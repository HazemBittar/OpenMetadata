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

import { Col, Row, Table, Tabs, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { MlHyperParameter } from '../../../generated/api/data/createMlModel';
import { Tag } from '../../../generated/entity/classification/tag';
import { Mlmodel, MlStore } from '../../../generated/entity/data/mlmodel';
import { PageType } from '../../../generated/system/ui/page';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreMlmodel } from '../../../rest/mlModelAPI';
import { getEmptyPlaceholder, getFeedCounts } from '../../../utils/CommonUtils';
import {
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import mlModelDetailsClassBase from '../../../utils/MlModel/MlModelClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { MlModelDetailProp } from './MlModelDetail.interface';

const MlModelDetail: FC<MlModelDetailProp> = ({
  updateMlModelDetailsState,
  mlModelDetail,
  fetchMlModel,
  followMlModelHandler,
  unFollowMlModelHandler,
  settingsUpdateHandler,
  onUpdateVote,
  versionHandler,
  handleToggleDelete,
  onMlModelUpdate,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const history = useHistory();
  const { tab: activeTab } = useParams<{ tab: EntityTabs }>();
  const { customizedPage } = useCustomPages(PageType.MlModel);

  const { fqn: decodedMlModelFqn } = useFqn();

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [mlModelPermissions, setMlModelPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();

  const mlModelName = useMemo(
    () => getEntityName(mlModelDetail),
    [mlModelDetail]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.ML_MODEL,
        mlModelDetail.id
      );
      setMlModelPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  }, [mlModelDetail.id, getEntityPermission, setMlModelPermissions]);

  useEffect(() => {
    if (mlModelDetail.id) {
      fetchResourcePermission();
    }
  }, [mlModelDetail.id]);

  const { isFollowing, deleted } = useMemo(() => {
    return {
      ...mlModelDetail,
      tier: getTierTags(mlModelDetail.tags ?? []),
      mlModelTags: getTagsWithoutTier(mlModelDetail.tags ?? []),
      entityName: mlModelName,
      isFollowing: mlModelDetail.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [mlModelDetail, mlModelName]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const fetchEntityFeedCount = () =>
    getFeedCounts(EntityType.MLMODEL, decodedMlModelFqn, handleFeedCount);

  useEffect(() => {
    if (mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic) {
      fetchEntityFeedCount();
    }
  }, [mlModelPermissions, decodedMlModelFqn]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(EntityType.MLMODEL, decodedMlModelFqn, activeKey)
      );
    }
  };

  const followMlModel = async () => {
    if (isFollowing) {
      await unFollowMlModelHandler();
    } else {
      await followMlModelHandler();
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwners?: Mlmodel['owners']) => {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        owners: newOwners,
      };
      await settingsUpdateHandler(updatedMlModelDetails);
    },
    [mlModelDetail, mlModelDetail.owners]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(mlModelDetail?.tags ?? [], newTier);
    const updatedMlModelDetails = {
      ...mlModelDetail,
      tags: tierTag,
    };

    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedMlModelDetails = {
      ...mlModelDetail,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleRestoreMlmodel = async () => {
    try {
      const { version: newVersion } = await restoreMlmodel(mlModelDetail.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.ml-model'),
        }),
        // Autoclose timer
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  };

  const getMlHyperParametersColumn: ColumnsType<MlHyperParameter> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
      },
    ],
    []
  );

  const mlModelStoreColumn = useMemo(() => {
    const column: ColumnsType<MlStore> = [
      {
        title: t('label.storage'),
        dataIndex: 'storage',
        key: 'storage',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
      {
        title: t('label.image-repository'),
        dataIndex: 'imageRepository',
        key: 'imageRepository',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
    ];

    return column;
  }, []);

  const getMlHyperParameters = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>
          {t('label.hyper-parameter-plural')}{' '}
        </Typography.Title>
        {isEmpty(mlModelDetail.mlHyperParameters) ? (
          getEmptyPlaceholder()
        ) : (
          <Table
            bordered
            columns={getMlHyperParametersColumn}
            data-testid="hyperparameters-table"
            dataSource={mlModelDetail.mlHyperParameters}
            pagination={false}
            rowKey="name"
            size="small"
          />
        )}
      </>
    );
  }, [mlModelDetail, getMlHyperParametersColumn]);

  const getMlModelStore = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>{t('label.model-store')}</Typography.Title>
        {mlModelDetail.mlStore ? (
          <Table
            bordered
            columns={mlModelStoreColumn}
            data-testid="model-store-table"
            dataSource={[mlModelDetail.mlStore]}
            id="model-store-table"
            pagination={false}
            rowKey="name"
            size="small"
          />
        ) : (
          getEmptyPlaceholder()
        )}
      </>
    );
  }, [mlModelDetail, mlModelStoreColumn]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const {
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (mlModelPermissions.EditTags || mlModelPermissions.EditAll) && !deleted,
      editGlossaryTermsPermission:
        (mlModelPermissions.EditGlossaryTerms || mlModelPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (mlModelPermissions.EditDescription || mlModelPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (mlModelPermissions.EditAll || mlModelPermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (mlModelPermissions.EditAll || mlModelPermissions.EditLineage) &&
        !deleted,
      viewAllPermission: mlModelPermissions.ViewAll,
    }),
    [mlModelPermissions, deleted]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = mlModelDetailsClassBase.getMlModelDetailPageTabs({
      feedCount,
      activeTab,
      mlModelDetail,
      getMlHyperParameters,
      getMlModelStore,
      handleFeedCount,
      fetchEntityFeedCount,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      fetchMlModel,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.FEATURES
    );
  }, [
    feedCount.totalCount,
    activeTab,
    mlModelDetail,
    getMlHyperParameters,
    getMlModelStore,
    handleFeedCount,
    fetchEntityFeedCount,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    fetchMlModel,
    customizedPage?.tabs,
  ]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.ml-model'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateMlModelDetailsState}
            dataAsset={mlModelDetail}
            entityType={EntityType.MLMODEL}
            openTaskCount={feedCount.openTaskCount}
            permissions={mlModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followMlModel}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreMlmodel}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Mlmodel>
          data={mlModelDetail}
          permissions={mlModelPermissions}
          type={EntityType.MLMODEL}
          onUpdate={onMlModelUpdate}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.FEATURES}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>

      <LimitWrapper resource="mlmodel">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<MlModelDetailProp>(MlModelDetail);
