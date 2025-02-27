/*
 *  Copyright 2025 Collate.
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
import Icon from '@ant-design/icons';
import { Card, Col, Radio, Row, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import {
  DATA_ASSET_ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { PIPELINE_TASK_TABS } from '../../../constants/pipeline.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  Pipeline,
  PipelineStatus,
  Task,
} from '../../../generated/entity/data/pipeline';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import { createTagObject } from '../../../utils/TagsUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TasksDAGView from '../TasksDAGView/TasksDAGView';

export const PipelineTaskTab = () => {
  const {
    data: pipelineDetails,
    permissions,
    onUpdate,
  } = useGenericContext<Pipeline>();
  const { fqn: pipelineFQN } = useFqn();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(PIPELINE_TASK_TABS.LIST_VIEW);
  const [selectedExecution] = useState<PipelineStatus | undefined>(
    pipelineDetails.pipelineStatus
  );
  const [editTask, setEditTask] = useState<{
    task: Task;
    index: number;
  }>();

  const { deleted } = pipelineDetails ?? {};

  const {
    editDescriptionPermission,
    editTagsPermission,
    editGlossaryTermsPermission,
  } = useMemo(
    () => ({
      editDescriptionPermission:
        permissions?.EditAll || permissions?.EditDescription,
      editTagsPermission: permissions?.EditAll || permissions?.EditTags,
      editGlossaryTermsPermission:
        permissions?.EditAll || permissions?.EditGlossaryTerms,
    }),
    [permissions]
  );

  const tasksInternal = useMemo(
    () =>
      pipelineDetails.tasks
        ? pipelineDetails.tasks.map((t) => ({ ...t, tags: t.tags ?? [] }))
        : [],
    [pipelineDetails.tasks]
  );

  const tagFilter = useMemo(() => {
    const tags = getAllTags(tasksInternal);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [tasksInternal]);

  const tasksDAGView = useMemo(
    () =>
      !isEmpty(pipelineDetails.tasks) && !isUndefined(pipelineDetails.tasks) ? (
        <Card className="task-dag-view-card" title={t('label.dag-view')}>
          <div className="h-100">
            <TasksDAGView
              selectedExec={selectedExecution}
              tasks={pipelineDetails.tasks}
            />
          </div>
        </Card>
      ) : (
        <Card className="text-center" data-testid="no-tasks-data">
          <span>{t('server.no-task-available')}</span>
        </Card>
      ),
    [pipelineDetails, selectedExecution]
  );

  const closeEditTaskModal = (): void => {
    setEditTask(undefined);
  };

  const onTaskUpdate = async (taskDescription: string) => {
    if (editTask) {
      const updatedTasks = [...(pipelineDetails.tasks ?? [])];

      const updatedTask = {
        ...editTask.task,
        description: taskDescription,
      };
      updatedTasks[editTask.index] = updatedTask;

      const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
      await onUpdate(updatedPipeline);
      setEditTask(undefined);
    } else {
      setEditTask(undefined);
    }
  };

  const handleTableTagSelection = async (
    selectedTags: EntityTags[],
    editColumnTag: Task
  ) => {
    const prevTags = editColumnTag.tags?.filter((tag) =>
      selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
    );

    const newTags = createTagObject(
      selectedTags.filter(
        (selectedTag) =>
          !editColumnTag.tags?.some((tag) => tag.tagFQN === selectedTag.tagFQN)
      )
    );

    const updatedTask = {
      ...editColumnTag,
      tags: [...(prevTags as TagLabel[]), ...newTags],
    } as Task;

    const updatedTasks: Task[] = [...(pipelineDetails.tasks ?? [])].map(
      (task) => (task.name === editColumnTag.name ? updatedTask : task)
    );

    const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
    await onUpdate(updatedPipeline);
  };

  const taskColumns: ColumnsType<Task> = useMemo(
    () => [
      {
        key: t('label.name'),
        dataIndex: 'name',
        title: t('label.name'),
        width: 220,
        fixed: 'left',
        sorter: getColumnSorter<Task, 'name'>('name'),
        render: (_, record) =>
          isEmpty(record.sourceUrl) ? (
            <span>{getEntityName(record)}</span>
          ) : (
            <Link
              className="flex items-center gap-2"
              target="_blank"
              to={{ pathname: record.sourceUrl }}>
              <div className="d-flex items-center">
                <span className="break-all">{getEntityName(record)}</span>

                <Icon
                  className="m-l-xs flex-none"
                  component={ExternalLinkIcon}
                  style={DATA_ASSET_ICON_DIMENSION}
                />
              </div>
            </Link>
          ),
      },
      {
        key: t('label.type'),
        dataIndex: 'taskType',
        width: 180,
        title: t('label.type'),
        render: (text) => (
          <Typography.Text>{text || NO_DATA_PLACEHOLDER}</Typography.Text>
        ),
      },
      {
        key: t('label.description'),
        dataIndex: 'description',
        width: 350,
        title: t('label.description'),
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            hasEditPermission={editDescriptionPermission}
            index={index}
            isReadOnly={deleted}
            onClick={() => setEditTask({ task: record, index })}
          />
        ),
      },
      {
        title: t('label.owner-plural'),
        dataIndex: 'owners',
        key: 'owners',
        width: 120,
        filterIcon: columnFilterIcon,
        render: (owner) => <OwnerLabel hasPermission={false} owners={owner} />,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: 300,
        filterIcon: columnFilterIcon,
        render: (tags, record, index) => (
          <TableTags<Task>
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={editTagsPermission}
            index={index}
            isReadOnly={deleted}
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
        width: 300,
        filterIcon: columnFilterIcon,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags, record, index) => (
          <TableTags<Task>
            entityFqn={pipelineFQN}
            entityType={EntityType.PIPELINE}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={editGlossaryTermsPermission}
            index={index}
            isReadOnly={deleted}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      deleted,
      editTask,
      editTagsPermission,
      editGlossaryTermsPermission,
      handleTableTagSelection,
      editDescriptionPermission,
    ]
  );

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <Radio.Group
          buttonStyle="solid"
          className="radio-switch"
          data-testid="pipeline-task-switch"
          optionType="button"
          options={Object.values(PIPELINE_TASK_TABS)}
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        />
      </Col>

      <Col span={24}>
        {activeTab === PIPELINE_TASK_TABS.LIST_VIEW ? (
          <Table
            bordered
            className="align-table-filter-left"
            columns={taskColumns}
            data-testid="task-table"
            dataSource={tasksInternal}
            pagination={false}
            rowKey="name"
            scroll={{ x: 1200 }}
            size="small"
          />
        ) : (
          tasksDAGView
        )}
      </Col>

      {editTask && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.task'),
          })}: "${getEntityName(editTask.task)}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.task-lowercase'),
          })}
          value={editTask.task.description ?? ''}
          visible={Boolean(editTask)}
          onCancel={closeEditTaskModal}
          onSave={onTaskUpdate}
        />
      )}
    </Row>
  );
};
