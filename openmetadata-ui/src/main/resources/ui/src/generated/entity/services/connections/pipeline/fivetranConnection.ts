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
 * Fivetran Metadata Database Connection Config
 */
export interface FivetranConnection {
    /**
     * Fivetran API Secret.
     */
    apiKey: string;
    /**
     * Fivetran API Secret.
     */
    apiSecret: string;
    /**
     * Pipeline Service Management/UI URI.
     */
    hostPort?: string;
    /**
     * Fivetran API Limit For Pagination.
     */
    limit?:                      number;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: FivetranType;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum FivetranType {
    Fivetran = "Fivetran",
}
