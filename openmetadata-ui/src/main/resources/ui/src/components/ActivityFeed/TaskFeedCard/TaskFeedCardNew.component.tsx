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
import Icon, { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { Button, Card, Col, Row, Tooltip, Typography } from 'antd';

import classNames from 'classnames';
import { isEmpty, isEqual, isUndefined, lowerCase } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as AssigneesIcon } from '../../../assets/svg/ic-assignees.svg';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as ReplyIcon } from '../../../assets/svg/ic-reply-2.svg';
import EntityPopOverCard from '../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import {
  Post,
  TaskDetails,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtils';

import { AxiosError } from 'axios';
import { ICON_DIMENSION_USER_PAGE } from '../../../constants/constants';
import { TaskOperation } from '../../../constants/Feeds.constants';
import { TASK_TYPES } from '../../../constants/Task.constant';
import { TaskType } from '../../../generated/api/feed/createThread';
import { ResolveTask } from '../../../generated/api/feed/resolveTask';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import DescriptionTaskNew from '../../../pages/TasksPage/shared/DescriptionTaskNew';
import TagsTask from '../../../pages/TasksPage/shared/TagsTask';
import { updateTask } from '../../../rest/feedsAPI';
import { getErrorText } from '../../../utils/StringsUtils';
import {
  getTaskDetailPath,
  isDescriptionTask,
  isTagsTask,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OwnerLabelNew } from '../../common/OwnerLabel/OwnerLabelNew.component';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './task-feed-card.less';

interface TaskFeedCardProps {
  post: Post;
  feed: Thread;
  className?: string;
  showThread?: boolean;
  isOpenInDrawer?: boolean;
  isActive?: boolean;
  isForFeedTab?: boolean;
  hidePopover: boolean;
  onAfterClose: any;
  onUpdateEntityDetails: any;
}

const TaskFeedCard = ({
  feed,
  className = '',
  isActive,
  onAfterClose,
  onUpdateEntityDetails,
}: TaskFeedCardProps) => {
  const history = useHistory();
  const { t } = useTranslation();
  const { setActiveThread } = useActivityFeedProvider();
  const { currentUser } = useApplicationStore();

  const { threadTs: timeStamp, task: taskDetails } = feed;

  const isTaskTags = isTagsTask(taskDetails?.type as TaskType);
  const isTaskDescription = isDescriptionTask(taskDetails?.type as TaskType);

  const { entityType, entityFQN } = useMemo(
    () => ({
      entityType: getEntityType(feed.about) ?? '',
      entityFQN: getEntityFQN(feed.about) ?? '',
    }),
    [feed.about]
  );

  const isEntityDetailsAvailable = useMemo(
    () => !isUndefined(entityFQN) && !isUndefined(entityType),
    [entityFQN, entityType]
  );

  const taskColumnName = useMemo(() => {
    const columnName = EntityLink.getTableColumnName(feed.about) ?? '';

    if (columnName) {
      return (
        <Typography.Text className="p-r-xss column-name">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [feed]);

  const handleTaskLinkClick = () => {
    history.push({
      pathname: getTaskDetailPath(feed),
    });
    setActiveThread(feed);
  };

  const taskLinkTitleElement = useMemo(
    () =>
      isEntityDetailsAvailable && !isUndefined(taskDetails) ? (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Button
            className="p-0 task-feed-header"
            data-testid="redirect-task-button-link"
            type="link"
            onClick={handleTaskLinkClick}>
            <Typography.Text className="m-r-xss task-details-id">{`#${taskDetails.id} `}</Typography.Text>

            <Typography.Text className="m-r-xss  m-r-xss task-details-entity-link">
              {TASK_TYPES[taskDetails.type]}
            </Typography.Text>

            {taskColumnName}

            <Typography.Text
              className="break-all text-primary text-sm"
              data-testid="entity-link">
              {getNameFromFQN(entityFQN)}
            </Typography.Text>

            <Typography.Text className="p-l-xss text-sm">{`(${entityType})`}</Typography.Text>
          </Button>
        </EntityPopOverCard>
      ) : null,
    [isEntityDetailsAvailable, entityFQN, entityType, taskDetails]
  );

  const isTaskTestCaseResult =
    taskDetails?.type === TaskType.RequestTestCaseFailureResolution;
  const isTaskGlossaryApproval = taskDetails?.type === TaskType.RequestApproval;

  const updateTaskData = (data: TaskDetails | ResolveTask) => {
    if (!taskDetails?.id) {
      return;
    }
    updateTask(TaskOperation.RESOLVE, taskDetails?.id + '', data)
      .then(() => {
        showSuccessToast(t('server.task-resolved-successfully'));
        onAfterClose?.();
        onUpdateEntityDetails?.();
      })
      .catch((err: AxiosError) =>
        showErrorToast(getErrorText(err, t('server.unexpected-error')))
      );
  };
  const onTaskResolve = () => {
    if (!isTaskGlossaryApproval && isEmpty(taskDetails?.suggestion)) {
      showErrorToast(
        t('message.field-text-is-required', {
          fieldText: isTaskTags
            ? t('label.tag-plural')
            : t('label.description'),
        })
      );

      return;
    }
    if (isTaskTags) {
      const tagsData = {
        newValue: taskDetails?.suggestion || '[]',
      };

      updateTaskData(tagsData as TaskDetails);
    } else {
      const newValue = isTaskGlossaryApproval
        ? 'approved'
        : taskDetails?.suggestion;
      const data = { newValue: newValue };
      updateTaskData(data as TaskDetails);
    }
  };
  const onTaskReject = () => {
    const updatedComment = isTaskGlossaryApproval ? 'Rejected' : 'Rejected';
    if (isTaskGlossaryApproval) {
      const data = { newValue: 'rejected' };
      updateTaskData(data as TaskDetails);

      return;
    }
    updateTask(TaskOperation.REJECT, taskDetails?.id + '', {
      comment: updatedComment,
    } as unknown as TaskDetails)
      .then(() => {
        showSuccessToast(t('server.task-closed-successfully'));
        onAfterClose?.();
        onUpdateEntityDetails?.();
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const isAssignee = taskDetails?.assignees?.some((assignee) =>
    isEqual(assignee.id, currentUser?.id)
  );

  return (
    <Button block className="remove-button-default-styling" type="text">
      <div
        className={classNames(className, 'task-feed-card-v1-new', {
          active: isActive,
        })}
        data-testid="task-feed-card">
        <Row gutter={isTaskDescription ? undefined : [0, 14]}>
          <Col className="d-flex flex-col align-start">
            <Col>
              <Icon
                className="m-r-xss m-t-xss text-md"
                component={
                  taskDetails?.status === ThreadTaskStatus.Open
                    ? TaskOpenIcon
                    : TaskCloseIcon
                }
                data-testid={`task-status-icon-${lowerCase(
                  taskDetails?.status
                )}`}
              />
              {taskLinkTitleElement}
            </Col>
            <Col style={{ marginTop: '-8px' }}>
              <Typography.Text>
                <UserPopOverCard
                  key={feed.createdBy}
                  userName={feed.createdBy ?? ''}>
                  <span
                    className="task-created-by-text p-r-xss"
                    data-testid="task-created-by">
                    {feed.createdBy}
                  </span>
                </UserPopOverCard>
                <span className="task-timestamp-text">
                  {t('message.created-this-task-lowercase')}
                </span>
                {timeStamp && (
                  <Tooltip title={formatDateTime(timeStamp)}>
                    <span
                      className="p-l-xss task-timestamp-text"
                      data-testid="timestamp">
                      {getRelativeTime(timeStamp)}
                    </span>
                  </Tooltip>
                )}
              </Typography.Text>
            </Col>
          </Col>
          <Col span={24}>
            {isTaskTags && (
              <Card
                bordered
                className="activity-feed-card-message tags-card-container">
                <TagsTask
                  hasEditAccess={false}
                  isTaskActionEdit={false}
                  task={taskDetails}
                />
              </Card>
            )}
          </Col>
          {isTaskDescription && (
            <DescriptionTaskNew
              hasEditAccess={false}
              isTaskActionEdit={false}
              taskThread={feed}
            />
          )}
          <Col
            className="task-feed-card-footer  d-flex align-center justify-between"
            span={24}>
            <Col className="d-flex">
              <Col className="d-flex flex-center">
                <ReplyIcon className="m-r-xs" />
                {feed.posts && feed.posts?.length > 0 && (
                  <span className="posts-length m-r-xss">
                    {t(
                      feed.posts.length === 1
                        ? 'label.one-reply'
                        : 'label.number-reply-plural',
                      { number: feed.posts.length }
                    )}
                  </span>
                )}
              </Col>

              <Col
                className={`flex items-center gap-2 text-grey-muted ${
                  feed?.posts && feed?.posts?.length > 0
                    ? 'task-card-assignee'
                    : ''
                }`}>
                <AssigneesIcon {...ICON_DIMENSION_USER_PAGE} />
                <OwnerLabelNew
                  avatarSize={16}
                  className="p-t-05"
                  owners={feed?.task?.assignees}
                />
              </Col>
            </Col>

            {!isTaskTestCaseResult && isAssignee && (
              <Col className="d-flex gap-2">
                {feed.task?.status === ThreadTaskStatus.Open && (
                  <Button
                    className="approve-btn d-flex items-center"
                    icon={<CheckCircleFilled />}
                    type="primary"
                    onClick={onTaskResolve}>
                    {t('label.approve')}
                  </Button>
                )}
                {feed.task?.status === ThreadTaskStatus.Open && (
                  <Button
                    className="reject-btn  d-flex items-center"
                    icon={<CloseCircleFilled />}
                    type="default"
                    onClick={onTaskReject}>
                    {t('label.reject')}
                  </Button>
                )}
              </Col>
            )}
          </Col>
        </Row>
      </div>
    </Button>
  );
};

export default TaskFeedCard;
