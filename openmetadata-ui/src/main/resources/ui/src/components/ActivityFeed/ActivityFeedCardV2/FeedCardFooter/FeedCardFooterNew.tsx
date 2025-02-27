/*
 *  Copyright 2024 Collate.
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

import { Avatar, Button, Col, Row } from 'antd';
import classNames from 'classnames';
import { min, noop, sortBy } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { ReactComponent as ThreadIcon } from '../../../../assets/svg/ic-reply-2.svg';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import { ReactionType } from '../../../../generated/type/reaction';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { useActivityFeedProvider } from '../../ActivityFeedProvider/ActivityFeedProvider';
import Reactions from '../../Reactions/Reactions';
import { FeedCardFooterProps } from './FeedCardFooter.interface';

function FeedCardFooterNew({
  feed,
  post,
  isPost = false,
}: Readonly<FeedCardFooterProps>) {
  const { showDrawer, updateReactions, fetchUpdatedThread } =
    useActivityFeedProvider();

  // The number of posts in the thread
  const postLength = useMemo(() => feed?.postsCount ?? 0, [feed?.postsCount]);

  // The latest reply timestamp and the list of unique users who replied
  const { repliedUniqueUsersList } = useMemo(() => {
    const posts = sortBy(feed?.posts, 'postTs').reverse();
    const latestReplyTimeStamp = posts[0]?.postTs;

    const repliedUsers = [...new Set((feed?.posts ?? []).map((f) => f.from))];

    const repliedUniqueUsersList = repliedUsers.slice(
      0,
      min([3, repliedUsers.length])
    );

    return { latestReplyTimeStamp, repliedUniqueUsersList };
  }, [feed?.posts]);

  const onReactionUpdate = useCallback(
    async (reaction: ReactionType, operation: ReactionOperation) => {
      await updateReactions(post, feed.id, !isPost, reaction, operation);
      await fetchUpdatedThread(feed.id);
    },
    [updateReactions, post, feed.id, isPost, fetchUpdatedThread]
  );

  const showReplies = useCallback(() => {
    showDrawer?.(feed);
  }, [showDrawer, feed]);

  return (
    <Row align="top" className={classNames({ 'm-y-md': isPost })}>
      <Col className="footer-container" span={24}>
        <div>
          <div className="flex items-center gap-2  w-full rounded-8">
            {postLength > 0 && !isPost && (
              <Avatar.Group>
                {repliedUniqueUsersList.slice(0, 2).map((user) => (
                  <ProfilePicture
                    avatarType="outlined"
                    key={user}
                    name={user}
                    size={20}
                  />
                ))}
              </Avatar.Group>
            )}

            {!isPost && (
              <Button
                className="flex-center p-0"
                data-testid="thread-count"
                icon={<ThreadIcon height={20} />}
                shape="circle"
                size="small"
                style={{ marginTop: '2px' }}
                type="text"
                onClick={showReplies}
              />
            )}

            <Reactions
              reactions={post.reactions ?? []}
              onReactionSelect={onReactionUpdate ?? noop}
            />
          </div>
        </div>
      </Col>
    </Row>
  );
}

export default FeedCardFooterNew;
