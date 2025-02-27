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

import {
  Col,
  Radio,
  RadioChangeEvent,
  Row,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import { Key } from 'antd/lib/table/interface';
import classNames from 'classnames';
import { cloneDeep, groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataTypeTopic,
  Field,
  MessageSchemaObject,
  Topic,
} from '../../../generated/entity/data/topic';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityName } from '../../../utils/EntityUtils';
import { getVersionedSchema } from '../../../utils/SchemaVersionUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  getAllRowKeysByKeyName,
  getTableExpandableConfig,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import ToggleExpandButton from '../../common/ToggleExpandButton/ToggleExpandButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  SchemaViewType,
  TopicSchemaFieldsProps,
} from './TopicSchema.interface';

const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  className,
  schemaTypePlaceholder,
}) => {
  const { t } = useTranslation();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.FIELDS
  );
  const { fqn: entityFqn } = useFqn();
  const {
    data: topicDetails,
    isVersionView,
    permissions,
    onUpdate,
    currentVersionData,
  } = useGenericContext<Topic>();

  const isReadOnly = useMemo(() => {
    // If there is a current version, it should be read only
    return currentVersionData ? true : topicDetails.deleted;
  }, [currentVersionData, topicDetails.deleted]);

  const messageSchema = useMemo(
    () =>
      isVersionView && currentVersionData?.changeDescription
        ? getVersionedSchema(
            currentVersionData?.['messageSchema'] as MessageSchemaObject,
            currentVersionData?.changeDescription
          )
        : topicDetails.messageSchema,
    [currentVersionData, isVersionView, topicDetails]
  );

  const {
    hasDescriptionEditAccess,
    hasTagEditAccess,
    hasGlossaryTermEditAccess,
  } = useMemo(
    () => ({
      hasDescriptionEditAccess:
        permissions.EditAll || permissions.EditDescription,
      hasTagEditAccess: permissions.EditAll || permissions.EditTags,
      hasGlossaryTermEditAccess:
        permissions.EditAll || permissions.EditGlossaryTerms,
    }),
    [permissions]
  );

  const schemaAllRowKeys = useMemo(() => {
    return getAllRowKeysByKeyName<Field>(
      messageSchema?.schemaFields ?? [],
      'name'
    );
  }, [messageSchema?.schemaFields]);

  const handleFieldTagsChange = async (
    selectedTags: EntityTags[],
    editColumnTag: Field
  ) => {
    if (selectedTags && editColumnTag && !isUndefined(onUpdate)) {
      const schema = cloneDeep(messageSchema);
      updateFieldTags<Field>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        schema?.schemaFields
      );
      await onUpdate({ ...topicDetails, messageSchema: schema });
    }
  };

  const handleFieldDescriptionChange = async (updatedDescription: string) => {
    if (!isUndefined(editFieldDescription) && !isUndefined(onUpdate)) {
      const schema = cloneDeep(messageSchema);
      updateFieldDescription<Field>(
        editFieldDescription.fullyQualifiedName ?? '',
        updatedDescription,
        schema?.schemaFields
      );
      await onUpdate({ ...topicDetails, messageSchema: schema });
      setEditFieldDescription(undefined);
    } else {
      setEditFieldDescription(undefined);
    }
  };

  const toggleExpandAll = () => {
    if (expandedRowKeys.length < schemaAllRowKeys.length) {
      setExpandedRowKeys(schemaAllRowKeys);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleExpandedRowsChange = (keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  };

  const renderSchemaName = useCallback(
    (_, record: Field) => (
      <div className="d-inline-flex w-max-90 vertical-align-inherit">
        <Tooltip destroyTooltipOnHide title={getEntityName(record)}>
          <span className="break-word">
            {isVersionView ? (
              <RichTextEditorPreviewerV1 markdown={getEntityName(record)} />
            ) : (
              getEntityName(record)
            )}
          </span>
        </Tooltip>
      </div>
    ),
    [isVersionView]
  );

  const renderDataType = useCallback(
    (dataType: DataTypeTopic, record: Field) => (
      <Typography.Text>
        {isVersionView ? (
          <RichTextEditorPreviewerV1
            markdown={record.dataTypeDisplay ?? dataType}
          />
        ) : (
          record.dataTypeDisplay ?? dataType
        )}
      </Typography.Text>
    ),
    [isVersionView]
  );

  const tagFilter = useMemo(() => {
    const tags = getAllTags(messageSchema?.schemaFields ?? []);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [messageSchema?.schemaFields]);

  const columns: ColumnsType<Field> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        fixed: 'left',
        width: 220,
        render: renderSchemaName,
      },
      {
        title: t('label.type'),
        dataIndex: 'dataType',
        key: 'dataType',
        ellipsis: true,
        width: 220,
        render: renderDataType,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 350,
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={entityFqn}
            entityType={EntityType.TOPIC}
            hasEditPermission={hasDescriptionEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditFieldDescription(record)}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            entityFqn={entityFqn}
            entityType={EntityType.TOPIC}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Classification}
          />
        ),
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        accessor: 'tags',
        width: 300,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            entityFqn={entityFqn}
            entityType={EntityType.TOPIC}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasGlossaryTermEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
    ],
    [
      isReadOnly,
      messageSchema,
      hasTagEditAccess,
      editFieldDescription,
      hasDescriptionEditAccess,
      handleFieldTagsChange,
      renderSchemaName,
      renderDataType,
    ]
  );

  const handleViewChange = (e: RadioChangeEvent) => {
    setViewType(e.target.value);
  };

  useEffect(() => {
    setExpandedRowKeys(schemaAllRowKeys);
  }, []);

  return (
    <Row className="mt-4" gutter={[16, 16]}>
      {messageSchema?.schemaType && (
        <Col>
          <Typography.Text type="secondary">
            {t('label.schema')}
          </Typography.Text>
          {schemaTypePlaceholder ?? (
            <Tag className="ml-4">{messageSchema.schemaType}</Tag>
          )}
        </Col>
      )}
      {isEmpty(messageSchema?.schemaFields) &&
      isEmpty(messageSchema?.schemaText) ? (
        <ErrorPlaceHolder />
      ) : (
        <>
          {!isEmpty(messageSchema?.schemaFields) && (
            <Col span={24}>
              <Row justify="space-between">
                {!isVersionView && (
                  <Col>
                    <Radio.Group value={viewType} onChange={handleViewChange}>
                      <Radio.Button value={SchemaViewType.FIELDS}>
                        {t('label.field-plural')}
                      </Radio.Button>
                      <Radio.Button value={SchemaViewType.TEXT}>
                        {t('label.text')}
                      </Radio.Button>
                    </Radio.Group>
                  </Col>
                )}
                <Col flex="auto">
                  <Row justify="end">
                    <Col>
                      <ToggleExpandButton
                        allRowKeys={schemaAllRowKeys}
                        expandedRowKeys={expandedRowKeys}
                        toggleExpandAll={toggleExpandAll}
                      />
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Col>
          )}
          <Col span={24}>
            {viewType === SchemaViewType.TEXT ||
            isEmpty(messageSchema?.schemaFields) ? (
              messageSchema?.schemaText && (
                <SchemaEditor
                  className="custom-code-mirror-theme custom-query-editor"
                  editorClass={classNames('table-query-editor')}
                  mode={{ name: CSMode.JAVASCRIPT }}
                  options={{
                    styleActiveLine: false,
                  }}
                  value={messageSchema?.schemaText ?? ''}
                />
              )
            ) : (
              <Table
                bordered
                className={classNames('align-table-filter-left', className)}
                columns={columns}
                data-testid="topic-schema-fields-table"
                dataSource={messageSchema?.schemaFields}
                expandable={{
                  ...getTableExpandableConfig<Field>(),
                  rowExpandable: (record) => !isEmpty(record.children),
                  onExpandedRowsChange: handleExpandedRowsChange,
                  expandedRowKeys,
                }}
                pagination={false}
                rowKey="name"
                scroll={TABLE_SCROLL_VALUE}
                size="small"
              />
            )}
          </Col>
        </>
      )}
      {editFieldDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.schema-field'),
          })}: "${getEntityName(editFieldDescription)}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.schema-field'),
          })}
          value={editFieldDescription.description ?? ''}
          visible={Boolean(editFieldDescription)}
          onCancel={() => setEditFieldDescription(undefined)}
          onSave={handleFieldDescriptionChange}
        />
      )}
    </Row>
  );
};

export default TopicSchemaFields;
