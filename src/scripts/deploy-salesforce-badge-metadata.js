const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  objects,
  definitionFields,
  earnedFields
} = require('./provision-salesforce-badges');

const targetOrg = process.env.SALESFORCE_CLI_TARGET_ORG || 'codex-integration';
const namespace = 'http://soap.sforce.com/2006/04/metadata';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function elements(metadata, indentation = '  ') {
  return Object.keys(metadata)
    .map(key => {
      const value = metadata[key];
      if (value == null) return '';
      if (typeof value === 'object') {
        return `${indentation}<${key}>\n${elements(
          value,
          `${indentation}  `
        )}\n${indentation}</${key}>`;
      }
      return `${indentation}<${key}>${escapeXml(value)}</${key}>`;
    })
    .filter(Boolean)
    .join('\n');
}

function objectXml(metadata) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<CustomObject xmlns="${namespace}">\n${elements(
      metadata
    )}\n</CustomObject>\n`
  );
}

function fieldXml(metadata) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<CustomField xmlns="${namespace}">\n${elements(
      metadata
    )}\n</CustomField>\n`
  );
}

function writeMetadata(root) {
  const fieldsByObject = {
    Badge_Definition__c: definitionFields,
    Badge_Earned__c: earnedFields
  };
  objects.forEach(object => {
    const objectDirectory = path.join(root, 'objects', object.fullName);
    const fieldDirectory = path.join(objectDirectory, 'fields');
    fs.mkdirSync(fieldDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(objectDirectory, `${object.fullName}.object-meta.xml`),
      objectXml(object.metadata)
    );
    fieldsByObject[object.fullName].forEach(([fieldName, metadata]) => {
      fs.writeFileSync(
        path.join(fieldDirectory, `${fieldName}.field-meta.xml`),
        fieldXml({ fullName: fieldName, ...metadata })
      );
    });
  });
  const permissionDirectory = path.join(root, 'permissionsets');
  fs.mkdirSync(permissionDirectory, { recursive: true });
  const allFields = [
    ...definitionFields
      .filter(([, metadata]) => !metadata.required)
      .map(([name]) => `Badge_Definition__c.${name}`),
    ...earnedFields
      .filter(([, metadata]) => !metadata.required)
      .map(([name]) => `Badge_Earned__c.${name}`)
  ];
  const fieldPermissions = allFields
    .map(
      field =>
        `  <fieldPermissions>\n` +
        `    <editable>true</editable>\n` +
        `    <field>${field}</field>\n` +
        `    <readable>true</readable>\n` +
        `  </fieldPermissions>`
    )
    .join('\n');
  const objectPermissions = ['Badge_Definition__c', 'Badge_Earned__c']
    .map(
      object =>
        `  <objectPermissions>\n` +
        `    <allowCreate>true</allowCreate>\n` +
        `    <allowDelete>true</allowDelete>\n` +
        `    <allowEdit>true</allowEdit>\n` +
        `    <allowRead>true</allowRead>\n` +
        `    <modifyAllRecords>true</modifyAllRecords>\n` +
        `    <object>${object}</object>\n` +
        `    <viewAllRecords>true</viewAllRecords>\n` +
        `  </objectPermissions>`
    )
    .join('\n');
  fs.writeFileSync(
    path.join(permissionDirectory, 'AXS_Map_Badge_Sync.permissionset-meta.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<PermissionSet xmlns="${namespace}">\n` +
      '  <description>Synchronize AXS Map badge definitions and earned badges.</description>\n' +
      `${fieldPermissions}\n` +
      '  <hasActivationRequired>false</hasActivationRequired>\n' +
      '  <label>AXS Map Badge Sync</label>\n' +
      `${objectPermissions}\n` +
      '</PermissionSet>\n'
  );
}

function main() {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'axs-badge-metadata-')
  );
  const source = path.join(temporary, 'main', 'default');
  fs.writeFileSync(
    path.join(temporary, 'sfdx-project.json'),
    `${JSON.stringify(
      {
        packageDirectories: [{ path: 'main', default: true }],
        namespace: '',
        sourceApiVersion: '64.0'
      },
      null,
      2
    )}\n`
  );
  writeMetadata(source);
  const deployment = spawnSync(
    'sf',
    [
      'project',
      'deploy',
      'start',
      '--source-dir',
      source,
      '--target-org',
      targetOrg,
      '--wait',
      '10',
      '--json'
    ],
    { encoding: 'utf8', cwd: temporary }
  );
  if (deployment.stdout) console.log(deployment.stdout);
  if (deployment.stderr) console.error(deployment.stderr);
  if (deployment.status !== 0)
    process.exit(deployment.status == null ? 1 : deployment.status);
  const assignment = spawnSync(
    'sf',
    [
      'org',
      'assign',
      'permset',
      '--name',
      'AXS_Map_Badge_Sync',
      '--target-org',
      targetOrg,
      '--json'
    ],
    { encoding: 'utf8', cwd: temporary }
  );
  if (assignment.stdout) console.log(assignment.stdout);
  if (assignment.stderr) console.error(assignment.stderr);
  process.exit(assignment.status == null ? 1 : assignment.status);
}

main();
