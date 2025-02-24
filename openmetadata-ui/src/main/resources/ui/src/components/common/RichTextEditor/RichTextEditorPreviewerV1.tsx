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
import { Button } from 'antd';
import classNames from 'classnames';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESCRIPTION_MAX_PREVIEW_CHARACTERS } from '../../../constants/constants';
import {
  formatContent,
  isDescriptionContentEmpty,
} from '../../../utils/BlockEditorUtils';
import BlockEditor from '../../BlockEditor/BlockEditor';
import './rich-text-editor-previewerV1.less';
import { PreviewerProp } from './RichTextEditor.interface';

const RichTextEditorPreviewerV1: FC<PreviewerProp> = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  showReadMoreBtn = true,
  maxLength = DESCRIPTION_MAX_PREVIEW_CHARACTERS,
  isDescriptionExpanded = false,
}) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [readMore, setReadMore] = useState<boolean>(false);

  const handleReadMoreToggle = () => setReadMore((pre) => !pre);

  // whether has read more content or not
  const hasReadMore = useMemo(
    () => enableSeeMoreVariant && markdown.length > maxLength,
    [enableSeeMoreVariant, markdown, maxLength]
  );

  useEffect(() => {
    setContent(formatContent(markdown, 'client'));
  }, [markdown]);

  useEffect(() => {
    setReadMore(Boolean(isDescriptionExpanded));
  }, [isDescriptionExpanded]);

  // if markdown is empty then show no description placeholder
  if (isDescriptionContentEmpty(markdown)) {
    return <span className="text-grey-muted">{t('label.no-description')}</span>;
  }

  return (
    <div
      className={classNames('rich-text-editor-container', className, {
        'text-right': i18n.dir() === 'rtl',
      })}
      data-testid="viewer-container"
      dir={i18n.dir()}>
      <div
        className={classNames(
          'markdown-parser',
          textVariant,
          readMore ? '' : 'text-clamp-2'
        )}
        data-testid="markdown-parser">
        <BlockEditor autoFocus={false} content={content} editable={false} />
      </div>
      {hasReadMore && showReadMoreBtn && (
        <Button
          className="text-xs text-right"
          data-testid={`read-${readMore ? 'less' : 'more'}-button`}
          style={{ fontSize: '14px', color: '#175CD3 !important' }}
          type="link"
          onClick={handleReadMoreToggle}>
          {readMore ? t('label.view-less') : t('label.view-more')}
        </Button>
      )}
    </div>
  );
};

export default RichTextEditorPreviewerV1;
