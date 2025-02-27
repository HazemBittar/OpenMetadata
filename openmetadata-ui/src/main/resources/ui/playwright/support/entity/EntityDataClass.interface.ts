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
export interface EntityDataClassCreationConfig {
  all?: boolean;
  table?: boolean;
  topic?: boolean;
  dashboard?: boolean;
  mlModel?: boolean;
  pipeline?: boolean;
  dashboardDataModel?: boolean;
  apiCollection?: boolean;
  apiEndpoint?: boolean;
  storedProcedure?: boolean;
  searchIndex?: boolean;
  container?: boolean;
  databaseService?: boolean;
  database?: boolean;
  databaseSchema?: boolean;
  apiService?: boolean;
  dashboardService?: boolean;
  messagingService?: boolean;
  mlmodelService?: boolean;
  pipelineService?: boolean;
  searchIndexService?: boolean;
  storageService?: boolean;
}
