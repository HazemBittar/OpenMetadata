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
import { Divider, Space, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import classNames from 'classnames';
import { get, isEmpty, isUndefined } from 'lodash';
import React, { Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as DomainIcon } from '../assets/svg/ic-domain.svg';
import { ReactComponent as SubDomainIcon } from '../assets/svg/ic-subdomain.svg';
import { TreeListItem } from '../components/common/DomainSelectableTree/DomainSelectableTree.interface';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { DomainExpertWidget } from '../components/Domain/DomainExpertsWidget/DomainExpertWidget';
import DataProductsTab from '../components/Domain/DomainTabs/DataProductsTab/DataProductsTab.component';
import { DomainTypeWidget } from '../components/Domain/DomainTypeWidget/DomainTypeWidget';
import SubDomainsTable from '../components/Domain/SubDomainsTable/SubDomainsTable.component';
import EntitySummaryPanel from '../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import AssetsTabs from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  DEFAULT_DOMAIN_VALUE,
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../constants/constants';
import { DOMAIN_TYPE_DATA } from '../constants/Domain.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { Domain } from '../generated/entity/domains/domain';
import { EntityReference } from '../generated/entity/type';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { DomainDetailPageTabProps } from './Domain/DomainClassBase';
import { getEntityName, getEntityReferenceFromEntity } from './EntityUtils';
import i18n from './i18next/LocalUtil';
import { getDomainPath } from './RouterUtils';

export const getOwner = (
  hasPermission: boolean,
  owners: EntityReference[],
  ownerDisplayNames: ReactNode[]
) => {
  if (!isEmpty(owners)) {
    return <OwnerLabel ownerDisplayName={ownerDisplayNames} owners={owners} />;
  }
  if (!hasPermission) {
    return <div>{NO_DATA_PLACEHOLDER}</div>;
  }

  return null;
};

export const getQueryFilterToIncludeDomain = (
  domainFqn: string,
  dataProductFqn: string
) => ({
  query: {
    bool: {
      must: [
        {
          term: {
            'domain.fullyQualifiedName': domainFqn,
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  'dataProducts.fullyQualifiedName': dataProductFqn,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  entityType: 'dataProduct',
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getQueryFilterToExcludeDomainTerms = (
  fqn: string,
  parentFqn?: string
): QueryFilterInterface => {
  const mustTerm: QueryFieldInterface[] = parentFqn
    ? [
        {
          term: {
            'domain.fullyQualifiedName': parentFqn,
          },
        },
      ]
    : [];

  return {
    query: {
      bool: {
        must: mustTerm.concat([
          {
            bool: {
              must_not: [
                {
                  term: {
                    'domain.fullyQualifiedName': fqn,
                  },
                },
              ],
            },
          },
        ]),
      },
    },
  };
};

export const getQueryFilterForDomain = (domainFqn: string) => ({
  query: {
    bool: {
      must: [{ prefix: { 'domain.fullyQualifiedName': domainFqn } }],
      must_not: [
        {
          term: {
            entityType: 'dataProduct',
          },
        },
      ],
    },
  },
});

// Domain type description which will be shown in tooltip
export const domainTypeTooltipDataRender = () => (
  <Space direction="vertical" size="middle">
    {DOMAIN_TYPE_DATA.map(({ type, description }, index) => (
      <Fragment key={type}>
        <Space direction="vertical" size={0}>
          <Typography.Text>{`${type} :`}</Typography.Text>
          <Typography.Paragraph className="m-0 text-grey-muted">
            {description}
          </Typography.Paragraph>
        </Space>

        {index !== 2 && <Divider className="m-0" />}
      </Fragment>
    ))}
  </Space>
);

export const getDomainOptions = (domains: Domain[] | EntityReference[]) => {
  const domainOptions: ItemType[] = [
    {
      label: i18n.t('label.all-domain-plural'),
      key: DEFAULT_DOMAIN_VALUE,
    },
  ];

  domains.forEach((domain) => {
    domainOptions.push({
      label: getEntityName(domain),
      key: domain.fullyQualifiedName ?? '',
      icon: get(domain, 'parent') ? (
        <SubDomainIcon
          color={DE_ACTIVE_COLOR}
          height={20}
          name="subdomain"
          width={20}
        />
      ) : (
        <DomainIcon
          color={DE_ACTIVE_COLOR}
          height={20}
          name="domain"
          width={20}
        />
      ),
    });
  });

  return domainOptions;
};

export const renderDomainLink = (
  domain: EntityReference,
  domainDisplayName: ReactNode,
  showDomainHeading: boolean,
  textClassName?: string
) => (
  <Link
    className={classNames(
      'no-underline domain-link',
      { 'text-xs': !showDomainHeading },
      textClassName
    )}
    data-testid="domain-link"
    style={{ color: '#535862', marginBottom: '8px' }}
    to={getDomainPath(domain?.fullyQualifiedName)}>
    {isUndefined(domainDisplayName) ? getEntityName(domain) : domainDisplayName}
  </Link>
);

export const initializeDomainEntityRef = (
  domains: EntityReference[],
  activeDomainKey: string
) => {
  const domain = domains.find((item) => {
    return item.fullyQualifiedName === activeDomainKey;
  });
  if (domain) {
    return getEntityReferenceFromEntity(domain, EntityType.DOMAIN);
  }

  return undefined;
};

export const getDomainFieldFromEntityType = (
  entityType: EntityType
): string => {
  if (entityType === EntityType.TEAM || entityType === EntityType.USER) {
    return 'domains';
  } else {
    return 'domain';
  }
};

export const convertDomainsToTreeOptions = (
  options: EntityReference[] | Domain[] = [],
  level = 0,
  multiple = false
): TreeListItem[] => {
  const treeData = options.map((option) => {
    const hasChildren = 'children' in option && !isEmpty(option?.children);

    return {
      id: option.id,
      value: option.fullyQualifiedName,
      name: option.name,
      label: option.name,
      key: option.fullyQualifiedName,
      title: (
        <div className="d-flex items-center gap-1">
          {level === 0 ? (
            <DomainIcon
              color={DE_ACTIVE_COLOR}
              height={20}
              name="domain"
              width={20}
            />
          ) : (
            <SubDomainIcon
              color={DE_ACTIVE_COLOR}
              height={20}
              name="subdomain"
              width={20}
            />
          )}

          <Typography.Text ellipsis>{getEntityName(option)}</Typography.Text>
        </div>
      ),
      'data-testid': `tag-${option.fullyQualifiedName}`,
      isLeaf: !hasChildren,
      selectable: !multiple,
      children: hasChildren
        ? convertDomainsToTreeOptions(
            (option as unknown as Domain)?.children as EntityReference[],
            level + 1,
            multiple
          )
        : undefined,
    };
  });

  return treeData;
};

/**
 * Recursively checks if a domain exists in the hierarchy
 * @param domain The domain to search in
 * @param searchDomain The domain to search for
 * @returns boolean indicating if the domain exists
 */
export const isDomainExist = (
  domain: Domain,
  searchDomainFqn: string
): boolean => {
  if (domain.fullyQualifiedName === searchDomainFqn) {
    return true;
  }

  if (domain.children?.length) {
    return domain.children.some((child) =>
      isDomainExist(child as unknown as Domain, searchDomainFqn)
    );
  }

  return false;
};

export const getDomainDetailTabs = ({
  domain,
  isVersionsView,
  domainPermission,
  subDomains,
  dataProductsCount,
  assetCount,
  activeTab,
  onAddDataProduct,
  isSubDomainsLoading,
  queryFilter,
  assetTabRef,
  dataProductsTabRef,
  previewAsset,
  setPreviewAsset,
  setAssetModalVisible,
  handleAssetClick,
  handleAssetSave,
  setShowAddSubDomainModal,
}: DomainDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.DOCUMENTATION}
          name={i18n.t('label.documentation')}
        />
      ),
      key: EntityTabs.DOCUMENTATION,
      children: <GenericTab type={PageType.Domain} />,
    },
    ...(!isVersionsView
      ? [
          {
            label: (
              <TabsLabel
                count={subDomains.length ?? 0}
                id={EntityTabs.SUBDOMAINS}
                isActive={activeTab === EntityTabs.SUBDOMAINS}
                name={i18n.t('label.sub-domain-plural')}
              />
            ),
            key: EntityTabs.SUBDOMAINS,
            children: (
              <SubDomainsTable
                isLoading={isSubDomainsLoading}
                permissions={domainPermission}
                subDomains={subDomains}
                onAddSubDomain={() => setShowAddSubDomainModal(true)}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                count={dataProductsCount ?? 0}
                id={EntityTabs.DATA_PRODUCTS}
                isActive={activeTab === EntityTabs.DATA_PRODUCTS}
                name={i18n.t('label.data-product-plural')}
              />
            ),
            key: EntityTabs.DATA_PRODUCTS,
            children: (
              <DataProductsTab
                permissions={domainPermission}
                ref={dataProductsTabRef}
                onAddDataProduct={onAddDataProduct}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                count={assetCount ?? 0}
                id={EntityTabs.ASSETS}
                isActive={activeTab === EntityTabs.ASSETS}
                name={i18n.t('label.asset-plural')}
              />
            ),
            key: EntityTabs.ASSETS,
            children: (
              <ResizablePanels
                className="domain-height-with-resizable-panel"
                firstPanel={{
                  className: 'domain-resizable-panel-container',
                  children: (
                    <div className="p-x-md p-y-md">
                      <AssetsTabs
                        assetCount={assetCount}
                        entityFqn={domain.fullyQualifiedName}
                        isSummaryPanelOpen={false}
                        permissions={domainPermission}
                        queryFilter={queryFilter}
                        ref={assetTabRef}
                        type={AssetsOfEntity.DOMAIN}
                        onAddAsset={() => setAssetModalVisible(true)}
                        onAssetClick={handleAssetClick}
                        onRemoveAsset={handleAssetSave}
                      />
                    </div>
                  ),
                  minWidth: 800,
                  flex: 0.87,
                }}
                hideSecondPanel={!previewAsset}
                pageTitle={i18n.t('label.domain')}
                secondPanel={{
                  children: previewAsset && (
                    <EntitySummaryPanel
                      entityDetails={previewAsset}
                      handleClosePanel={() => setPreviewAsset(undefined)}
                    />
                  ),
                  minWidth: 400,
                  flex: 0.13,
                  className:
                    'entity-summary-resizable-right-panel-container domain-resizable-panel-container',
                }}
              />
            ),
          },
        ]
      : []),
  ];
};

export const getDomainWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.EXPERTS)) {
    return <DomainExpertWidget />;
  } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DOMAIN_TYPE)) {
    return <DomainTypeWidget />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DOMAIN}
      showTaskHandler={false}
      widgetConfig={widgetConfig}
    />
  );
};
