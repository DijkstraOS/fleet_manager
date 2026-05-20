# AGV Interoperability Validation Plan

Created: 2026-05-19  
Primary validation day: 2026-05-20

## Purpose

This project should not only run its own web editor, server, and simulator together. The validation goal is to prove that the system is aligned with the relevant external standards and can interoperate with external tools, dummy AGVs, and eventually field AGVs without relying on private assumptions shared only between this server and this simulator.

The pass should answer four questions:

1. Are we using the proper VDA 5050 v2.1 TypeScript library, schemas, and protocol version?
2. Are our LIF imports and exports compatible with other LIF editors and validators?
3. Can our server and simulator interoperate with external VDA 5050 clients instead of only each other?
4. Does the architecture keep standards, app behavior, simulator behavior, and UI concerns cleanly separated?

## External References

- VDA 5050 official specification repository: https://github.com/VDA5050/VDA5050
- VDA 5050 v2.1.0 schemas tag: https://github.com/VDA5050/VDA5050/tree/2.1.0/json_schemas
- VDA 5050 TypeScript/JavaScript library: https://www.npmjs.com/package/vda-5050-lib
- VDA 5050 CLI and schema tooling: https://www.npmjs.com/package/vda-5050-cli
- VDMA LIF guideline PDF: https://www.vdma.eu/documents/34570/3317035/FuI_Guideline_LIF_GB.pdf
- Fletr LIF import/export tooling: https://fletr.io/documentation
- Open-source VDA5050 LIF editor candidate: https://github.com/bekirbostanci/vda5050_lif_editor

## Preliminary Findings

### VDA 5050

- 2026-05-20 update: `vda-5050-lib@1.7.0` is now installed in `@agv/core`, `@agv/server`, and `@agv/simulator`.
- 2026-05-20 update: the server now uses `MasterControlClient` for VDA order publication and state/visualization/connection subscriptions.
- 2026-05-20 update: the simulator now uses one `AgvClient` per simulated AGV for VDA order subscription and state/visualization/connection publication.
- 2026-05-20 update: integration tests now assert that runtime state and sent orders carry `version: "2.1.0"` plus VDA header fields.
- Earlier finding, now closed: the implementation did not depend on `vda-5050-lib` or `vda-5050-cli`; `npm ls vda-5050-lib vda-5050-cli --all` returned empty.
- Current npm metadata check shows `vda-5050-lib` latest version `1.7.0` and `vda-5050-cli` latest version `2.4.0`.
- The official VDA 5050 repository is now on `3.0.0`, so this project must intentionally pin all validation to the `2.1.0` tag/schemas if v2.1 is the client target.
- Earlier finding, now closed for live MQTT publication: the local `VdaOrder`, `VdaState`, and connection payloads were headerless. Official v2.1 `order`, `state`, and `connection` schemas require `headerId`, `timestamp`, `version`, `manufacturer`, and `serialNumber`.
- Earlier direct schema checks of locally generated headerless payloads failed against official v2.1 schemas. The live MQTT path now relies on `vda-5050-lib` to add headers and validate VDA topic payloads.

### LIF

- The local LIF exporter writes `metaInformation.lifVersion` as `1.0.0`. The inspected VDMA LIF guideline describes `lifVersion` as the LIF semantic version and shows `0.11.0`.
- Current import reads only the first layout in a LIF document.
- Current import/export is likely lossy for external LIF files:
  - layout-level `stations` are collected as unsupported data but are not exported again;
  - node-level `mapId` is treated as known but is not mapped into the internal model or exported;
  - `vehicleTypeNodeProperties` are replaced with a default vehicle type on export;
  - only the first `vehicleTypeEdgeProperties` entry is interpreted;
  - unsupported layout fields other than `layoutDescription` are not restored on export.
- The README honestly describes trajectory preservation, but this is not enough for full LIF interoperability.

### Local System Health

- `npm run architecture:check` passed.
- `npm test` passed: 7 files, 16 tests.
- `npm run build` passed for core, server, simulator, and web.
- `npm run test:e2e` passed: 1 Chromium smoke test.
- These results prove the internal demo path is coherent. They do not prove external VDA 5050 or LIF compatibility.

## Validation Workstreams

### 1. Standards Baseline

Outcome: a pinned, repeatable definition of what "compatible" means.

Tasks:

- Confirm that the project target is VDA 5050 `2.1.0`, not `2.0.0` or current `3.0.0`.
- Treat the VDA 5050 `2.1.0` schemas as the compatibility oracle for MQTT payloads.
- Decide whether "proper TypeScript library" means adopting `vda-5050-lib` for runtime client behavior, using `vda-5050-cli` for schema/type generation, or both.
- Add a validation note for the non-official status of libraries: the official VDA/VDMA artifact is the specification/schema repository; `vda-5050-lib` is the practical TypeScript implementation candidate.
- Record the exact package versions chosen for the validation pass.

Acceptance:

- There is one pinned VDA version for code, tests, docs, and MQTT topics.
- Generated or imported types match the official v2.1 schemas.
- Any local wrapper around a VDA library has explicit responsibilities and does not silently change message semantics.

### 2. VDA 5050 Payload Validation

Outcome: the server and simulator publish and consume schema-valid v2.1 messages.

Tasks:

- Validate outgoing `order` messages against official `order.schema`.
- Validate incoming simulator or dummy `state`, `visualization`, and `connection` messages against official schemas.
- Add negative tests for malformed messages, missing headers, wrong protocol versions, invalid topic shape, and unknown AGV identity.
- Confirm MQTT topic structure and version segment for v2.1.
- Confirm message header behavior:
  - `headerId` increments per topic;
  - `timestamp` is ISO8601 UTC;
  - `version` is exactly the target protocol version;
  - `manufacturer` and `serialNumber` agree with the MQTT topic.
- Confirm connection semantics, including offline and broken-connection behavior.

Acceptance:

- Every VDA payload emitted by the server or simulator passes official v2.1 schema validation.
- Invalid payloads are rejected or quarantined instead of becoming trusted app state.
- Server and simulator no longer accept each other's private headerless shape as the only happy path.

### 3. LIF Compatibility

Outcome: LIF round trips work with external LIF tools without losing important semantics.

Tasks:

- Pick at least two external LIF tools:
  - Fletr for import/export smoke testing;
  - an open-source VDA5050 LIF editor or another client-provided editor for editable round trips.
- Create a small external map with:
  - at least three nodes;
  - directed edges;
  - stations;
  - node and edge actions;
  - multiple vehicle type properties where supported;
  - at least one trajectory-bearing edge.
- Export from the external editor and import into this app.
- Export from this app and import back into the external editor.
- Repeat in the opposite direction: create in this app, export, import externally, edit externally, re-import here.
- Compare the original and round-tripped LIF with a semantic diff, not only raw JSON equality.
- Validate required LIF fields against the VDMA guideline, including `metaInformation`, `layoutId`, `layoutVersion`, node `mapId`, stations, vehicle type properties, and action data.

Acceptance:

- External LIF files import without manual cleanup.
- LIF exported by this app imports into external tools without warnings or silent data loss.
- Round-trip differences are either zero or explicitly documented as intentional unsupported scope.
- Unsupported fields are preserved unless the user explicitly edits or deletes them.

### 4. Third-Party Simulator And Dummy AGV Interop

Outcome: the server can talk to non-local dummy AGVs, and the simulator can talk to a non-local master control or protocol tool.

Tasks:

- Connect a third-party or independently written dummy AGV to this server's MQTT broker.
- Send a simple order from this server to the external dummy AGV and observe valid state transitions.
- Connect this simulator to an external VDA 5050 master control or validation harness.
- Confirm behavior for:
  - AGV appears online;
  - order accepted;
  - order rejected;
  - state updates;
  - visualization updates;
  - offline/connection broken;
  - wrong manufacturer/serial number;
  - wrong protocol version.
- Confirm that the simulator does not rely on REST-only map preload assumptions when acting like an external AGV.

Acceptance:

- At least one external dummy AGV can complete an order sent by this server.
- At least one external master/control harness can receive valid state/connection/visualization from this simulator.
- Failures are visible and diagnosable in logs/UI instead of silently ignored.

### 5. Architecture Review

Outcome: standards compatibility is enforced at boundaries, not scattered through app code.

Tasks:

- Review `packages/core` as the domain and standards boundary.
- Review `apps/server` as the VDA master/control boundary.
- Review `apps/simulator` as a vehicle-plane test adapter, not as the definition of truth.
- Review `apps/web` as an editor and observer, not a protocol authority.
- Check that schema validation and VDA library integration happen at MQTT/API boundaries.
- Check that LIF conversion is isolated from editor state and can be tested independently.
- Check that imported data carries enough provenance to support round-trip comparisons.

Acceptance:

- Core types either come from official/generated schemas or are thin, reviewed adapters around them.
- Server/simulator coupling is constrained to VDA 5050 messages, not private TypeScript assumptions.
- LIF conversion has fixture-based tests from external tools.
- The app can explain which unsupported external features are preserved, rejected, or dropped.

## Suggested May 20 Sequence

1. Freeze the target standards: VDA 5050 `2.1.0`, LIF guideline version, selected external LIF editors, and dummy AGV tools.
2. Add repeatable schema validation scripts/tests for VDA `order`, `state`, `connection`, and `visualization`.
3. Run current payloads through those validators and record every incompatibility.
4. Build or collect two LIF fixtures from external editors.
5. Run import/export/import round trips and produce a semantic diff.
6. Connect one external dummy AGV or independent MQTT harness and send one order.
7. Update this document with pass/fail results and the smallest implementation backlog needed to close gaps.

## Current Risk Register

| Risk | Evidence | Severity | Next action |
| --- | --- | --- | --- |
| VDA payloads are headerless | Closed on live MQTT path by using `MasterControlClient` and `AgvClient`; integration test asserts v2.1 headers | Closed | Add third-party AGV/master-control interop fixtures next |
| No VDA library dependency | Closed; `vda-5050-lib@1.7.0` installed in core/server/simulator | Closed | Keep package pinned and monitor package/spec drift |
| LIF export may declare wrong LIF version | Exporter writes `lifVersion: "1.0.0"` while inspected guideline shows `0.11.0` | High | Confirm intended LIF spec version and align exporter |
| LIF round trip is likely lossy | Stations, node `mapId`, vehicle type properties, and layout unsupported fields are not fully restored | High | Create external fixtures and preserve unsupported data by default |
| Simulator/server overfit | Current green tests exercise local server plus local simulator | Medium | Add external dummy AGV and external master/control harness checks |
| External compatibility has no fixture suite | Existing tests use demo/local maps only | Medium | Add fixtures from external LIF editors and official VDA schemas |

## Evidence Log

- Local commands run on 2026-05-19:
  - `npm run architecture:check`: passed.
  - `npm test`: passed, 7 files and 16 tests.
  - `npm run build`: passed.
  - `npm run test:e2e`: passed, 1 Chromium smoke test.
  - `npm ls vda-5050-lib vda-5050-cli --all`: no dependencies installed.
  - `npm view vda-5050-lib version time.modified versions --json`: latest `1.7.0`, modified `2026-04-29T13:14:11.777Z`.
  - `npm view vda-5050-cli version time.modified versions --json`: latest `2.4.0`, modified `2026-04-28T11:46:37.285Z`.
  - Official v2.1 schema checks against current local payload shapes: `order`, `state`, and `connection` failed due missing header fields.
- Local commands run on 2026-05-20 after `vda-5050-lib` integration:
  - `npm ls vda-5050-lib --all`: `vda-5050-lib@1.7.0` installed in `@agv/core`, `@agv/server`, and `@agv/simulator`.
  - `npm test`: passed, 8 files and 25 tests.
  - `npm run build`: passed.
  - `npm run architecture:check`: passed.
  - `env PLAYWRIGHT_WEB_PORT=6174 PLAYWRIGHT_API_PORT=4101 PLAYWRIGHT_MQTT_PORT=1885 npm run test:e2e`: passed, 1 Chromium smoke test.
