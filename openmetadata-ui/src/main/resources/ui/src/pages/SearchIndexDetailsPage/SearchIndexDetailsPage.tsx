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
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  getEntityDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { SearchIndex, TagLabel } from '../../generated/entity/data/searchIndex';
import { PageType } from '../../generated/system/ui/page';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  addFollower,
  getSearchIndexDetailsByFQN,
  patchSearchIndexDetails,
  removeFollower,
  restoreSearchIndex,
  updateSearchIndexVotes,
} from '../../rest/SearchIndexAPI';
import { addToRecentViewed, getFeedCounts } from '../../utils/CommonUtils';
import {
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import searchIndexClassBase from '../../utils/SearchIndexDetailsClassBase';
import { defaultFields } from '../../utils/SearchIndexUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

function SearchIndexDetailsPage() {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { tab: activeTab = EntityTabs.FIELDS } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedSearchIndexFQN } = useFqn();
  const { t } = useTranslation();
  const history = useHistory();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const [loading, setLoading] = useState<boolean>(true);
  const [searchIndexDetails, setSearchIndexDetails] = useState<SearchIndex>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { customizedPage } = useCustomPages(PageType.SearchIndex);

  const [searchIndexPermissions, setSearchIndexPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const viewPermission = useMemo(
    () => searchIndexPermissions.ViewAll || searchIndexPermissions.ViewBasic,
    [searchIndexPermissions]
  );

  const fetchSearchIndexDetails = async () => {
    setLoading(true);
    try {
      const fields = defaultFields;
      const details = await getSearchIndexDetailsByFQN(decodedSearchIndexFQN, {
        fields,
      });

      setSearchIndexDetails(details);
      addToRecentViewed({
        displayName: getEntityName(details),
        entityType: EntityType.SEARCH_INDEX,
        fqn: details.fullyQualifiedName ?? '',
        serviceType: details.serviceType,
        timestamp: 0,
        id: details.id,
      });
    } catch (error) {
      // Error here
    } finally {
      setLoading(false);
    }
  };

  const {
    searchIndexTags,
    owners,
    version,
    followers = [],
    description,
    entityName,
    deleted,
    id: searchIndexId = '',
  } = useMemo(() => {
    if (searchIndexDetails) {
      const { tags } = searchIndexDetails;

      return {
        ...searchIndexDetails,
        tier: getTierTags(tags ?? []),
        searchIndexTags: getTagsWithoutTier(tags ?? []),
        entityName: getEntityName(searchIndexDetails),
      };
    }

    return {} as SearchIndex & {
      tier: TagLabel;
      searchIndexTags: EntityTags[];
      entityName: string;
    };
  }, [searchIndexDetails, searchIndexDetails?.tags]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    viewSampleDataPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (searchIndexPermissions.EditTags || searchIndexPermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (searchIndexPermissions.EditGlossaryTerms ||
          searchIndexPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (searchIndexPermissions.EditDescription ||
          searchIndexPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (searchIndexPermissions.EditAll ||
          searchIndexPermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (searchIndexPermissions.EditAll ||
          searchIndexPermissions.EditLineage) &&
        !deleted,
      viewSampleDataPermission:
        searchIndexPermissions.ViewAll || searchIndexPermissions.ViewSampleData,
      viewAllPermission: searchIndexPermissions.ViewAll,
    }),
    [searchIndexPermissions, deleted]
  );

  const fetchResourcePermission = useCallback(
    async (entityFQN) => {
      try {
        const searchIndexPermission = await getEntityPermissionByFqn(
          ResourceEntity.SEARCH_INDEX,
          entityFQN
        );

        setSearchIndexPermissions(searchIndexPermission);
      } finally {
        setLoading(false);
      }
    },
    [getEntityPermissionByFqn]
  );

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(
      EntityType.SEARCH_INDEX,
      decodedSearchIndexFQN,
      handleFeedCount
    );

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(
          EntityType.SEARCH_INDEX,
          decodedSearchIndexFQN,
          activeKey
        )
      );
    }
  };
  const saveUpdatedSearchIndexData = useCallback(
    (updatedData: SearchIndex) => {
      const jsonPatch = compare(
        omitBy(searchIndexDetails, isUndefined),
        updatedData
      );

      return patchSearchIndexDetails(searchIndexId, jsonPatch);
    },
    [searchIndexDetails, searchIndexId]
  );

  const onSearchIndexUpdate = async (
    updatedSearchIndex: SearchIndex,
    key?: keyof SearchIndex
  ) => {
    try {
      const res = await saveUpdatedSearchIndexData(updatedSearchIndex);

      setSearchIndexDetails((previous) => {
        if (!previous) {
          return;
        }

        return {
          ...previous,
          ...res,
          ...(key && { [key]: res[key] }),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (newOwners?: SearchIndex['owners']) => {
      if (!searchIndexDetails) {
        return;
      }
      const updatedSearchIndexDetails = {
        ...searchIndexDetails,
        owners: newOwners,
      };
      await onSearchIndexUpdate(updatedSearchIndexDetails, 'owners');
    },
    [owners, searchIndexDetails]
  );

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (!searchIndexDetails) {
      return;
    }
    if (description !== updatedHTML) {
      const updatedSearchIndexDetails = {
        ...searchIndexDetails,
        description: updatedHTML,
      };
      await onSearchIndexUpdate(updatedSearchIndexDetails, 'description');
    }
  };

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!searchIndexDetails) {
      return;
    }
    const updatedSearchIndex = {
      ...searchIndexDetails,
      displayName: data.displayName,
    };
    await onSearchIndexUpdate(updatedSearchIndex, 'displayName');
  };

  const onExtensionUpdate = useCallback(
    async (updatedData: SearchIndex) => {
      searchIndexDetails &&
        (await onSearchIndexUpdate(
          {
            ...searchIndexDetails,
            extension: updatedData.extension,
          },
          'extension'
        ));
    },
    [saveUpdatedSearchIndexData, searchIndexDetails]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);
    const allTabs = searchIndexClassBase.getSearchIndexDetailPageTabs({
      searchIndexDetails: searchIndexDetails ?? ({} as SearchIndex),
      viewAllPermission,
      feedCount,
      activeTab,
      getEntityFeedCount,
      fetchSearchIndexDetails,
      handleFeedCount,
      viewSampleDataPermission,
      deleted: deleted ?? false,
      editLineagePermission,
      editCustomAttributePermission,
      onExtensionUpdate,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      allTabs,
      customizedPage?.tabs,
      EntityTabs.FIELDS
    );
  }, [
    activeTab,
    searchIndexDetails,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    entityName,
    onExtensionUpdate,
    handleFeedCount,
    getEntityFeedCount,
    viewSampleDataPermission,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    searchIndexDetails,
    searchIndexDetails?.extension,
    onDescriptionUpdate,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
  ]);

  const onTierUpdate = useCallback(
    async (newTier?: Tag) => {
      if (searchIndexDetails) {
        const tierTag: SearchIndex['tags'] = updateTierTag(
          searchIndexTags,
          newTier
        );
        const updatedSearchIndexDetails = {
          ...searchIndexDetails,
          tags: tierTag,
        };

        await onSearchIndexUpdate(updatedSearchIndexDetails, 'tags');
      }
    },
    [searchIndexDetails, onSearchIndexUpdate, searchIndexTags]
  );

  const handleToggleDelete = (version?: number) => {
    setSearchIndexDetails((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const handleRestoreSearchIndex = async () => {
    try {
      const { version: newVersion } = await restoreSearchIndex(searchIndexId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.search-index'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.search-index'),
        })
      );
    }
  };

  const followSearchIndex = useCallback(async () => {
    try {
      const res = await addFollower(searchIndexId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setSearchIndexDetails((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(searchIndexDetails),
        })
      );
    }
  }, [USERId, searchIndexId]);

  const unFollowSearchIndex = useCallback(async () => {
    try {
      const res = await removeFollower(searchIndexId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setSearchIndexDetails((pre) => {
        if (!pre) {
          return pre;
        }

        return {
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(searchIndexDetails),
        })
      );
    }
  }, [USERId, searchIndexId]);

  const onUpdateVote = async (data: QueryVote, id: string) => {
    try {
      await updateSearchIndexVotes(id, data);
      const details = await getSearchIndexDetailsByFQN(decodedSearchIndexFQN, {
        fields: defaultFields,
      });
      setSearchIndexDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USERId),
    };
  }, [followers, USERId]);

  const handleFollowSearchIndex = useCallback(async () => {
    isFollowing ? await unFollowSearchIndex() : await followSearchIndex();
  }, [isFollowing, unFollowSearchIndex, followSearchIndex]);

  const versionHandler = useCallback(() => {
    version &&
      history.push(
        getVersionPath(
          EntityType.SEARCH_INDEX,
          decodedSearchIndexFQN,
          version + ''
        )
      );
  }, [version]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as SearchIndex;

    setSearchIndexDetails((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    if (decodedSearchIndexFQN) {
      fetchResourcePermission(decodedSearchIndexFQN);
    }
  }, [decodedSearchIndexFQN]);

  useEffect(() => {
    if (viewPermission) {
      fetchSearchIndexDetails();
      getEntityFeedCount();
    }
  }, [decodedSearchIndexFQN, viewPermission]);

  if (loading) {
    return <Loader />;
  }

  if (!viewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (!searchIndexDetails) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.search-index'),
      })}
      title={t('label.entity-detail-plural', {
        entity: t('label.search-index'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" data-testid="entity-page-header" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={searchIndexDetails}
            entityType={EntityType.SEARCH_INDEX}
            openTaskCount={feedCount.openTaskCount}
            permissions={searchIndexPermissions}
            onDisplayNameUpdate={handleDisplayNameUpdate}
            onFollowClick={handleFollowSearchIndex}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreSearchIndex}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>

        <GenericProvider<SearchIndex>
          data={searchIndexDetails}
          permissions={searchIndexPermissions}
          type={EntityType.SEARCH_INDEX}
          onUpdate={onSearchIndexUpdate}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.FIELDS}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>

        <LimitWrapper resource="searchIndex">
          <></>
        </LimitWrapper>
      </Row>
    </PageLayoutV1>
  );
}

export default SearchIndexDetailsPage;
