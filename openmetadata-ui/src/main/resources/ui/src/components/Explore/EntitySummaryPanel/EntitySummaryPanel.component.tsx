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

import { CloseOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';
import { get } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityLinkFromType,
} from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { DataAssetSummaryPanel } from '../../DataAssetSummaryPanel/DataAssetSummaryPanel';
import './entity-summary-panel.less';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';

export default function EntitySummaryPanel({
  entityDetails,
  highlights,
  handleClosePanel,
}: EntitySummaryPanelProps) {
  const { tab } = useParams<{ tab: string }>();
  const { getEntityPermission } = usePermissionProvider();
  const [isPermissionLoading, setIsPermissionLoading] =
    useState<boolean>(false);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const id = useMemo(() => {
    setIsPermissionLoading(true);

    return entityDetails?.details?.id ?? '';
  }, [entityDetails?.details?.id]);

  const fetchResourcePermission = async (entityFqn: string) => {
    try {
      setIsPermissionLoading(true);
      const type =
        get(entityDetails, 'details.entityType') ?? ResourceEntity.TABLE;
      const permissions = await getEntityPermission(type, entityFqn);
      setEntityPermissions(permissions);
    } catch (error) {
      // Error
    } finally {
      setIsPermissionLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  const viewPermission = useMemo(
    () => entityPermissions.ViewBasic || entityPermissions.ViewAll,
    [entityPermissions]
  );

  const summaryComponent = useMemo(() => {
    if (isPermissionLoading) {
      return <Loader />;
    }
    if (!viewPermission) {
      return (
        <ErrorPlaceHolder
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }
    const type = get(entityDetails, 'details.entityType') ?? EntityType.TABLE;
    const entity = entityDetails.details;

    return (
      <DataAssetSummaryPanel
        componentType={
          tab === DRAWER_NAVIGATION_OPTIONS.lineage
            ? tab
            : DRAWER_NAVIGATION_OPTIONS.explore
        }
        dataAsset={entity}
        entityType={type}
        highlights={highlights}
      />
    );
  }, [tab, entityDetails, viewPermission, isPermissionLoading]);

  const entityLink = useMemo(
    () => searchClassBase.getEntityLink(entityDetails.details),
    [entityDetails, getEntityLinkFromType]
  );
  const entityIcon = useMemo(() => {
    return (
      <span className="w-6 h-6 m-r-xs d-inline-flex text-xl align-middle entity-icon">
        {searchClassBase.getEntityIcon(
          get(entityDetails, 'details.entityType') ?? ''
        )}
      </span>
    );
  }, [entityDetails]);

  return (
    <Card
      className="summary-panel-container"
      extra={
        <CloseOutlined
          className="cursor-pointer"
          style={{ fontSize: 16 }}
          onClick={handleClosePanel}
        />
      }
      style={{ border: 'none' }}
      title={
        viewPermission && (
          <Link
            className="no-underline"
            data-testid="entity-link"
            target={searchClassBase.getSearchEntityLinkTarget(
              entityDetails.details
            )}
            to={entityLink}>
            <Typography.Text className="m-b-0 d-block summary-panel-title">
              {entityIcon}
              {stringToHTML(
                searchClassBase.getEntityName(entityDetails.details)
              )}
            </Typography.Text>
          </Link>
        )
      }>
      {summaryComponent}
    </Card>
  );
}
