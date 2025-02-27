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
/**
 * Atlas Connection Config
 */
export interface AtlasConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * service type of the data source.
     */
    databaseServiceName?: string[];
    /**
     * Name of the Entity Type available in Atlas.
     */
    entity_type: string;
    /**
     * Host and port of the Atlas service.
     */
    hostPort?: string;
    /**
     * service type of the messaging source
     */
    messagingServiceName?: string[];
    /**
     * password to connect  to the Atlas.
     */
    password:                    string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: AtlasType;
    /**
     * username to connect  to the Atlas. This user should have privileges to read all the
     * metadata in Atlas.
     */
    username: string;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum AtlasType {
    Atlas = "Atlas",
}
