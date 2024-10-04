# Adding a New Data Source to Briefer
This step-by-step guide outlines the process for adding a new data source to the Briefer project, covering both the backend and frontend integration. The guide assumes basic familiarity with the Briefer architecture and development environment.

# Backend Configuration
## 1. Configure the Database Schema
To allow Briefer to list the new data source, you need to add a new table to the Prisma schema.

**Steps**:
- Navigate to the Prisma schema file located at packages/database/prisma/schema.prisma.
- Add a new model for the data source in the following format:

```prisma
model <DATASOURCENAME> { 
  id             String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name           String
  host           String
  port           String
  database       String
  username       String
  password       String
  cert           String?
  notes          String
  structure      String?
  isDemo         Boolean    @default(false)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @default(now()) @updatedAt
  connStatus     ConnStatus @default(online)
  connError      String?
  lastConnection DateTime?
  workspaceId    String     @db.Uuid
  workspace      Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```
This defines the model for your new data source. Replace `<DATASOURCENAME>` with the appropriate name for your new data source.

## 2. Add Database Driver to Jupyter Requirements
To interact with the new data source from Jupyter notebooks, you need to add the required driver to the Jupyter environment.

**Steps**:
- Open apps/api/jupyter-requirements.txt.
- Add the driver for your data source in the following format:
```
<driver>==<version>
```
Replace <driver> and <version> with the appropriate driver name and version for your data source.

## 3. Add Database Driver to API Dependencies
To ensure the API can access the new data source, include the driver in the package.json file of the API.

**Steps**:
- Open apps/api/package.json.
- Add the driver dependency:

```json
"driver": "<version>",
```
Replace <driver> and <version> with the appropriate values.

## 4. Update Authentication for the New Data Source
You need to modify the authentication mechanism to check if the user has access to the new database.

**Steps**:
- Open apps/api/src/auth/token.ts.
- Add the following code to the appropriate switch statement:
```js
case <database>: 
  result = await <database>.ping(ds.data);
  break;
```
Replace <database> with the name of your new data source.

## 6. Create the Data Source Handler
Create the file that will handle operations like pinging the database and listing its schema.

**Steps**:
- Create a new file at apps/api/src/datasources/<new_database>.ts.

## 7. Update Structure and Query Handlers
Update the various structure and query handlers to account for the new data source.

**Files to update**:
- apps/api/src/datasources/structure.ts
- apps/api/src/python/query/index.ts
- apps/api/src/python/writeback/index.ts
- apps/api/src/v1/workspaces/workspace/data-sources/data-source.ts
- apps/api/src/v1/workspaces/workspace/data-sources/index.ts
- packages/database/src/datasources/index.ts

**New files to create**:

- apps/api/src/python/query/<new_database>.ts
- packages/database/src/datasources/<new_database>.ts

# Frontend Configuration
## 1. Add Data Source Icon
To ensure the new data source is displayed correctly in the UI, you need to add an icon for the data source.

**Steps**:
- Create an icon image for the data source.
- Place the image in apps/web/public/icons/<DATABASE_ICON>.png.

## 2. Update Data Source Icons
To display the new icon, update the DataSourceIcons component.

**Steps**:
- Open apps/web/src/components/DataSourceIcons.tsx.
- Add a reference to the new icon for the new data source.

## 3. Update Data Source List
The new data source needs to appear in the list of available data sources.

**Steps**:
- Open apps/web/src/components/DataSourcesList.tsx.
- Add the new data source type to the list.

## 4. Update Hooks for the New Data Source
To fetch and manage the new data source's state, update the useDatasource hook.

**Steps**:
- Open apps/web/src/hooks/useDatasource.ts.
- Add logic for fetching and managing the new data source.

## 5. Update Data Source Pages
Ensure that the pages for editing and creating data sources support the new type.

**Files to update**:
- apps/web/src/pages/workspaces/[workspaceId]/data-sources/edit/[dataSourceId].tsx
- apps/web/src/pages/workspaces/[workspaceId]/data-sources/new/index.tsx
- apps/web/src/pages/workspaces/[workspaceId]/data-sources/new/sqlserver.tsx

## 6. Create New Data Source Form
Create a form for the new data source type.

**Steps**:
- Create a new file at apps/web/src/components/forms/<NEW_DATABASE>.tsx.
- Implement the form fields for the new data source, ensuring fields like host, port, username, password, etc., are included.

# Conclusion
By following the steps in this guide, you will successfully integrate a new data source into the Briefer project. This includes both backend (API, database, authentication) and frontend (UI, forms, data handling) components.

Once the implementation is complete, thoroughly test the new data source functionality to ensure it works as expected across all parts of the application.