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
import { Col, Row, Steps, Typography } from 'antd';
import { last, toLower } from 'lodash';
import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AssigneesIcon } from '../../../../assets/svg/ic-assignees.svg';
import { ReactComponent as FailureCommentIcon } from '../../../../assets/svg/ic-failure-comment.svg';
import { ReactComponent as FailureReasonIcon } from '../../../../assets/svg/ic-failure-reason.svg';
import { ReactComponent as SeverityIcon } from '../../../../assets/svg/ic-severity.svg';
import { ReactComponent as UserIcon } from '../../../../assets/svg/ic-user-profile.svg';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { TEST_CASE_STATUS } from '../../../../constants/TestSuite.constant';
import { Thread } from '../../../../generated/entity/feed/thread';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { OwnerLabelNew } from '../../../common/OwnerLabel/OwnerLabelNew.component';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Severity from '../../../DataQuality/IncidentManager/Severity/Severity.component';
import './task-tab-incident-manager-header.style.less';

const TaskTabIncidentManagerHeaderNew = ({ thread }: { thread: Thread }) => {
  const { t } = useTranslation();
  const { testCaseResolutionStatus } = useActivityFeedProvider();
  const testCaseResolutionStepper = useMemo(() => {
    const updatedData = [...testCaseResolutionStatus];
    const lastStatusType = last(
      testCaseResolutionStatus
    )?.testCaseResolutionStatusType;

    if (lastStatusType && TEST_CASE_STATUS[lastStatusType]) {
      updatedData.push(
        ...TEST_CASE_STATUS[lastStatusType].map((type) => ({
          testCaseResolutionStatusType: type,
        }))
      );
    }

    return updatedData.map((status) => {
      let details: ReactNode = null;

      switch (status.testCaseResolutionStatusType) {
        case TestCaseResolutionStatusTypes.ACK:
          details = status.updatedBy ? (
            <Typography.Text className="text-grey-muted text-xss">
              {`By ${getEntityName(status.updatedBy)} on `}
            </Typography.Text>
          ) : null;

          break;
        case TestCaseResolutionStatusTypes.Assigned:
          details = status.testCaseResolutionStatusDetails?.assignee ? (
            <Typography.Text className="text-grey-muted text-xss">
              {`To ${getEntityName(
                status.testCaseResolutionStatusDetails?.assignee
              )} on `}
            </Typography.Text>
          ) : null;

          break;
        case TestCaseResolutionStatusTypes.Resolved:
          details = status.testCaseResolutionStatusDetails?.resolvedBy ? (
            <Typography.Text className="text-grey-muted text-xss">
              {`By ${getEntityName(
                status.testCaseResolutionStatusDetails.resolvedBy
              )} on `}
            </Typography.Text>
          ) : null;

          break;

        default:
          break;
      }

      return {
        className: toLower(status.testCaseResolutionStatusType),
        title: (
          <div>
            <Typography.Paragraph className="m-b-0">
              {status.testCaseResolutionStatusType}
            </Typography.Paragraph>
            <Typography.Paragraph className="m-b-0">
              {details}
              {status.updatedAt && (
                <Typography.Text className="text-grey-muted text-xss">
                  {formatDateTime(status.updatedAt)}
                </Typography.Text>
              )}
            </Typography.Paragraph>
          </div>
        ),
        key: status.testCaseResolutionStatusType,
      };
    });
  }, [testCaseResolutionStatus]);

  const latestTestCaseResolutionStatus = useMemo(
    () => last(testCaseResolutionStatus),
    [testCaseResolutionStatus]
  );

  const isResolved =
    latestTestCaseResolutionStatus?.testCaseResolutionStatusType ===
    TestCaseResolutionStatusTypes.Resolved;

  return (
    <Row data-testid="incident-manager-task-header-container" gutter={[8, 16]}>
      <Row className="m-l-0" gutter={[16, 16]}>
        <Col className="flex items-center gap-2 text-grey-muted" span={12}>
          <UserIcon height={16} />
          <Typography.Text className="incident-manager-details-label @grey-8">
            {t('label.created-by')}
          </Typography.Text>
        </Col>
        <Col className="flex items-center gap-2" span={12}>
          <ProfilePicture name={thread.createdBy ?? ''} width="24" />
          <Typography.Text>{thread.createdBy}</Typography.Text>
        </Col>
        <Col className="flex items-center gap-2 text-grey-muted" span={12}>
          <AssigneesIcon height={16} />
          <Typography.Text className="incident-manager-details-label @grey-8">
            {`${t('label.assignee-plural')} `}
          </Typography.Text>
        </Col>
        <Col className="flex items-center gap-2" span={12}>
          {thread?.task?.assignees?.length === 1 ? (
            <div className="d-flex items-center gap-2">
              <ProfilePicture
                name={thread?.task?.assignees[0].displayName ?? ''}
                width="24"
              />
              <Typography.Text className="text-md text-grey-body">
                {thread?.task?.assignees[0].displayName}
              </Typography.Text>
            </div>
          ) : (
            <OwnerLabelNew
              avatarSize={24}
              className="p-t-05"
              owners={thread?.task?.assignees}
            />
          )}
        </Col>

        <Col className="flex items-center gap-2 text-grey-muted" span={12}>
          <SeverityIcon height={16} />
          <Typography.Text className="incident-manager-details-label">
            {' '}
            {`${t('label.severity')} `}
          </Typography.Text>
        </Col>
        <Col className="flex items-center gap-2" span={12}>
          <Severity severity={latestTestCaseResolutionStatus?.severity} />
        </Col>

        {isResolved && (
          <Col className="flex items-center gap-2 text-grey-muted" span={12}>
            <FailureReasonIcon height={16} />
            <Typography.Text className="incident-manager-details-label">{`${t(
              'label.failure-reason'
            )}: `}</Typography.Text>
          </Col>
        )}
        {isResolved && (
          <Col className="flex items-center gap-2" span={12}>
            <Typography.Text className="text-sm incident-manager-text">
              {latestTestCaseResolutionStatus?.testCaseResolutionStatusDetails
                ?.testCaseFailureReason ?? NO_DATA_PLACEHOLDER}
            </Typography.Text>
          </Col>
        )}
        {isResolved && (
          <Col className="flex items-center gap-2 text-grey-muted" span={12}>
            <FailureCommentIcon height={16} />
            <Typography.Text className="incident-manager-details-label">
              {' '}
              {`${t('label.failure-comment')} `}
            </Typography.Text>
          </Col>
        )}
        {isResolved && (
          <Col className="flex items-center gap-2 " span={12}>
            <RichTextEditorPreviewerV1
              markdown={
                latestTestCaseResolutionStatus?.testCaseResolutionStatusDetails
                  ?.testCaseFailureComment ?? ''
              }
            />
          </Col>
        )}
        <Col span={24}>
          <div className="task-resolution-steps-container-new">
            <Steps
              className="task-resolution-steps w-full"
              current={testCaseResolutionStatus.length}
              data-testid="task-resolution-steps"
              items={testCaseResolutionStepper}
              labelPlacement="vertical"
              size="small"
            />
          </div>
        </Col>
      </Row>
    </Row>
  );
};

export default TaskTabIncidentManagerHeaderNew;
