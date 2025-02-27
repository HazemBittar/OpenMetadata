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

import { Col, Row } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import Lineage from '../components/Lineage/Lineage.component';
import MlModelFeaturesList from '../components/MlModel/MlModelDetail/MlModelFeaturesList';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import i18n from './i18next/LocalUtil';
import { MlModelDetailPageTabProps } from './MlModel/MlModelClassBase';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.DOMAIN},${TabSpecificField.OWNERS}, ${TabSpecificField.DASHBOARD},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION}`;

export const getMlModelDetailsPageTabs = ({
  feedCount,
  activeTab,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  fetchMlModel,
  handleFeedCount,
  mlModelDetail,
  getMlHyperParameters,
  getMlModelStore,
  fetchEntityFeedCount,
  labelMap,
}: MlModelDetailPageTabProps) => {
  return [
    {
      name: t('label.feature-plural'),
      label: (
        <TabsLabel
          id={EntityTabs.FEATURES}
          name={labelMap[EntityTabs.FEATURES] ?? i18n.t('label.feature-plural')}
        />
      ),
      key: EntityTabs.FEATURES,
      children: <GenericTab type={PageType.MlModel} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap[EntityTabs.ACTIVITY_FEED] ??
            i18n.t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.MLMODEL}
          onFeedUpdate={fetchEntityFeedCount}
          onUpdateEntityDetails={fetchMlModel}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.DETAILS}
          name={labelMap[EntityTabs.DETAILS] ?? i18n.t('label.detail-plural')}
        />
      ),
      key: EntityTabs.DETAILS,
      children: (
        <Row className="p-md" gutter={[16, 16]}>
          <Col span={12}>{getMlHyperParameters}</Col>
          <Col span={12}>{getMlModelStore}</Col>
        </Row>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={labelMap[EntityTabs.LINEAGE] ?? i18n.t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={Boolean(mlModelDetail.deleted)}
            entity={mlModelDetail as SourceType}
            entityType={EntityType.MLMODEL}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={
            labelMap[EntityTabs.CUSTOM_PROPERTIES] ??
            i18n.t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: mlModelDetail && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.MLMODEL>
            entityType={EntityType.MLMODEL}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
          />
        </div>
      ),
    },
  ];
};

export const getMlModelWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.ML_MODEL_FEATURES)) {
    return <MlModelFeaturesList />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.MLMODEL}
      widgetConfig={widgetConfig}
    />
  );
};
