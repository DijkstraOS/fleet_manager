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
- MQTT 5.0 OASIS standard: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.pdf
- Eclipse Mosquitto MQTT broker: https://mosquitto.org/
- EMQX MQTT broker documentation: https://docs.emqx.com/en/emqx/latest/
- Aedes embedded MQTT broker: https://www.npmjs.com/package/aedes
- VDMA LIF guideline PDF: https://www.vdma.eu/documents/34570/3317035/FuI_Guideline_LIF_GB.pdf
- VDMA LIF JSON schema and generated models: https://github.com/continua-systems/vdma-lif
- VDMA LIF TypeScript package: https://www.npmjs.com/package/vdma-lif
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

### MQTT Broker Topology

- 2026-05-20 finding: the project is already using an MQTT broker. `apps/server/src/infra/mqtt-gateway.ts` creates an embedded Aedes broker and exposes it at `mqtt://127.0.0.1:<port>`.
- 2026-05-20 finding: the server is also a client of that broker. It uses `MasterControlClient` to subscribe to AGV `state`, `visualization`, and `connection` topics and to publish `order` topics.
- 2026-05-20 finding: the simulator uses one `AgvClient` per simulated AGV. Each simulated AGV connects to the broker as an MQTT client, subscribes to `order`, and publishes `state` and `visualization`.
- 2026-05-20 finding: the topology is therefore broker-based, not direct server-to-AGV messaging. The current broker is simply embedded in the server process for local convenience.
- 2026-05-27 update: the server no longer hosts Aedes in-process. Local development starts `apps/broker` as a separate Aedes process, and the server and simulator connect through `MQTT_BROKER`.
- 2026-05-20 risk: Aedes is an embedded Node broker and its npm docs list MQTT 3.1/3.1.1 support while saying MQTT 5.0 is not supported yet. This may be acceptable for VDA 5050 v2.1 if field clients use MQTT 3.1.1, but it should not be assumed for production without checking the target AGV/broker requirements.
- 2026-05-20 risk: an embedded broker is useful for a self-contained demo, but it does not validate against the operational model likely used on-site: a separately managed broker with authentication, authorization, TLS, logging, retention/session settings, and broker-level monitoring.
- 2026-05-20 recommendation, now partially closed: move beyond in-process Aedes by adding a first-class external broker mode and test against at least Mosquitto and one heavier production broker candidate such as EMQX or HiveMQ.

### LIF

- 2026-05-20 update: `vdma-lif@1.0.0-7` is now installed in `@agv/core` and used at the LIF import/export boundary.
- 2026-05-20 update: LIF import now validates through `LIFParser.fromJson`, and LIF export round-trips through `LIFParser` before returning a document.
- The local LIF exporter writes `metaInformation.lifVersion` as `1.0.0`. The inspected VDMA LIF guideline describes `lifVersion` as the LIF semantic version and shows `0.11.0`.
- Current import reads only the first layout in a LIF document.
- Current import/export is likely lossy for external LIF files:
  - additional layouts after `layouts[0]` are not imported;
  - document metadata is normalized on export, although unknown metadata extensions are passively preserved;
  - node-level `mapId`, node descriptions, stations, layout level, and full node vehicle properties are passively preserved but not editable in the UI;
  - only the first `vehicleTypeEdgeProperties` entry is interpreted;
  - additional `vehicleTypeEdgeProperties` entries and unmodeled first-entry properties are passively preserved, but only the first entry drives the internal edge model.
- The README honestly describes trajectory preservation, but this is not enough for full LIF interoperability.

#### Current LIF Property Coverage

Source files inspected: `packages/core/src/lif/index.ts`, `packages/core/src/lif/types.ts`, and the VDMA LIF schema/model repository.

| LIF area | Properties | Current behavior | Interoperability implication |
| --- | --- | --- | --- |
| Document metadata | `metaInformation.projectIdentification`, `creator`, `exportTimestamp`, `lifVersion` | Import validates and stores metadata in the passive preservation envelope. Export normalizes project, creator, timestamp, and LIF version while preserving unknown metadata extensions. | Basic metadata is valid, but original creator/timestamp are not round-tripped as authoritative source metadata. |
| Document-level extras | Unknown top-level fields beside `metaInformation` and `layouts` | Stored under the passive preservation envelope and re-exported. | Vendor/tool extensions at document level now survive local round trips. |
| Layout collection | `layouts[]` | Import uses only `layouts[0]`; export writes exactly one layout. | Multi-layout files lose every layout after the first. |
| Layout identity | `layoutId`, `layoutName`, `layoutVersion` | Mapped to internal map `id`, `name`, and `version`. | Basic identity is supported. |
| Layout level | `layoutLevelId` | Stored in the passive preservation envelope and re-exported. | Preserved passively, not editable in the UI. |
| Layout description | `layoutDescription` | Stored in the passive preservation envelope and re-exported. | Preserved passively, not editable in the UI. |
| Stations | `stations[]`, including `stationId`, `interactionNodeIds`, `stationName`, `stationDescription`, `stationHeight`, `stationPosition` | Stored in the passive preservation envelope and re-exported. New local maps export `stations: []` to satisfy the VDMA model. | Station semantics now survive local round trips, but cannot be created or edited in the UI. |
| Node identity and position | `nodeId`, `nodeName`, `nodePosition.x`, `nodePosition.y` | Mapped to internal node `id`, `label`, `x`, and `y`. | Basic node geometry is supported. |
| Node map identity | `mapId` | Stored in the passive preservation envelope and re-exported. | Preserved passively, not editable in the UI. |
| Node description | `nodeDescription` | Preserved as a node-level unsupported field and re-exported. | Preserved passively, not editable in the UI. |
| Node orientation | `vehicleTypeNodeProperties[].theta` | First vehicle-type theta maps to internal node `theta`; legacy `nodePosition.theta` is only a fallback. | Basic node orientation is now aligned to the VDMA model for the first vehicle type. |
| Node vehicle properties | `vehicleTypeNodeProperties[]` | Stored in the passive preservation envelope and re-exported; internal node `theta` updates the first entry. | Vehicle-specific node capabilities survive, but only the first entry influences internal behavior. |
| Node actions | `vehicleTypeNodeProperties[].actions[]` and `actionParameters[]` | Stored in the passive preservation envelope and re-exported. | Actions survive local round trips, but cannot be edited or converted into VDA order actions yet. |
| Edge identity and endpoints | `edgeId`, `edgeName`, `startNodeId`, `endNodeId` | Mapped to internal edge `id`, `label`, `from`, and `to`. | Basic directed edge topology is supported. |
| Edge description | `edgeDescription` | Stored in the passive preservation envelope and re-exported. | Preserved passively, not editable in the UI. |
| Edge vehicle property cardinality | `vehicleTypeEdgeProperties[]` | Import reads only the first entry into the internal model; export preserves the full array and updates the first entry from internal edge fields. | Multi-vehicle-type edge data survives, but only the first entry influences routing/order generation. |
| Edge vehicle type | `vehicleTypeId` | Preserved from imported data; local-only edges still default to `"default"`. | Original vehicle type identity now survives imported round trips. |
| Edge motion fields | `vehicleOrientation`, `orientationType`, `rotationAllowed`, `maxSpeed` | Mapped from the first edge vehicle property and exported again. | Basic movement constraints are partially supported. Unit/semantic validation is still missing. |
| Edge rotation constraints | `rotationAtStartNodeAllowed`, `rotationAtEndNodeAllowed`, `maxRotationSpeed` | Stored in the passive preservation envelope and re-exported for imported first-entry vehicle properties. | Preserved passively, not used by routing/order generation. |
| Edge height/load restrictions | `minHeight`, `maxHeight`, `loadRestriction` | Stored in the passive preservation envelope and re-exported for imported first-entry vehicle properties. | Preserved passively, not used by routing/order generation. |
| Edge trajectory | `trajectory.degree`, `knotVector`, `controlPoints[]` | Preserved for the first edge vehicle property if the shape passes local checks. | Trajectories survive the current local path, but only for the first vehicle property. |
| Edge vehicle-property extensions | Unknown fields inside `vehicleTypeEdgeProperties[]` | Stored in the passive preservation envelope and re-exported. | Vendor-specific per-vehicle edge data now survives local round trips. |
| Edge top-level extras | Unknown fields beside the known edge keys | Preserved as edge-level unsupported data and re-exported. | Top-level edge extensions survive local round trips. |

Important preservation rule after the 2026-05-20 `vdma-lif` integration: the `unsupported` envelope now preserves more external LIF structure than before, including stations and vehicle-type properties. This is still not a complete semantic implementation. Preserved data can survive a local round trip without becoming editable or operationally enforced.

### Local System Health

- `npm run architecture:check` passed.
- `npm test` passed: 8 files, 28 tests.
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
- Validate import/export against the public `vdma-lif` JSON schema or generated TypeScript model package.
- Add explicit tests for the current preservation policy: supported, passively preserved, intentionally rejected, and currently dropped.

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

### 5. MQTT Broker Deployment Validation

Outcome: the project proves that the broker topology works both embedded and with an externally managed broker.

Tasks:

- Document the intended production topology:
  - standalone broker process/service;
  - server as master-control MQTT client;
  - each AGV as an MQTT client;
  - web UI as HTTP/WebSocket client of the server, not a direct MQTT participant unless explicitly required.
- Keep `MQTT_BROKER` as the server/simulator contract so the server can connect to an existing broker URL.
- Test the same order/state/visualization/connection flow against:
  - local standalone Aedes;
  - Eclipse Mosquitto;
  - one production broker candidate such as EMQX or HiveMQ.
- Validate broker-level behavior that matters for field deployment:
  - connection last will handling;
  - retained `connection` messages;
  - QoS 0 for `order`, `instantActions`, `state`, `factsheet`, and `visualization`;
  - QoS 1 for `connection`;
  - clean session / reconnect behavior;
  - authentication and ACLs;
  - TLS or network isolation;
  - broker logs/observability.
- Confirm that the configured VDA topic path remains compatible with `interfaceName/v2/manufacturer/serialNumber/topic` unless a cloud broker requires an adapted topic format.

Acceptance:

- The system can run with no embedded broker when `MQTT_BROKER` points to an external broker.
- Server and simulator interoperate through Mosquitto or another standalone broker without code changes.
- Broker configuration required for a field deployment is documented and repeatable.
- The validation plan clearly separates "broker library embedded for dev" from "standalone broker service for production."

### 6. Architecture Review

Outcome: standards compatibility is enforced at boundaries, not scattered through app code.

Tasks:

- Review `packages/core` as the domain and standards boundary.
- Review `apps/server` as the VDA master/control boundary.
- Review `apps/simulator` as a vehicle-plane test adapter, not as the definition of truth.
- Review `apps/web` as an editor and observer, not a protocol authority.
- Review `apps/server/src/infra/mqtt-gateway.ts` as two separate responsibilities: broker hosting and master-control client behavior.
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
7. Run the same flow through a standalone broker, starting with Mosquitto.
8. Update this document with pass/fail results and the smallest implementation backlog needed to close gaps.

## Current Risk Register

| Risk | Evidence | Severity | Next action |
| --- | --- | --- | --- |
| VDA payloads are headerless | Closed on live MQTT path by using `MasterControlClient` and `AgvClient`; integration test asserts v2.1 headers | Closed | Add third-party AGV/master-control interop fixtures next |
| No VDA library dependency | Closed; `vda-5050-lib@1.7.0` installed in core/server/simulator | Closed | Keep package pinned and monitor package/spec drift |
| No LIF schema/model dependency | Closed; `vdma-lif@1.0.0-7` installed in `@agv/core` and used by import/export | Closed | Keep package pinned and monitor package/schema drift |
| LIF version target needs confirmation | Export now writes `lifVersion: "1.0.0"` to match the integrated `vdma-lif` package; earlier inspected guideline note mentioned `0.11.0` | Medium | Confirm target LIF version with client/tooling before external certification |
| LIF round trip may still be lossy | Additional layouts are still dropped; many LIF fields are preserved passively but not editable or operationally interpreted | High | Create external fixtures and run semantic diffs against external editors |
| LIF unsupported-field preservation is partial | Stations and vehicle properties now survive local round trips, but the preservation envelope is internal and not yet proven against real editor outputs | Medium | Validate with Fletr and another LIF editor fixture |
| Embedded broker not field-representative | Local development now runs Aedes as a separate process, but production sites usually manage broker auth/TLS/monitoring separately | Medium | Test the same flow with Mosquitto/EMQX/HiveMQ |
| Broker feature mismatch | Aedes docs list MQTT 3.1/3.1.1 and no MQTT 5.0 support; target field broker requirements are not known yet | Medium | Confirm required MQTT protocol version and broker capabilities with client/AGV vendor |
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
- Local LIF documentation pass on 2026-05-20:
  - `npm view vdma-lif version description repository.url --json`: latest package metadata showed `1.0.0-7` from `continua-systems/vdma-lif`.
  - `npm ls vdma-lif --all`: no dependency installed.
  - Inspected `packages/core/src/lif/index.ts`, `packages/core/src/lif/types.ts`, and `packages/core/src/map/types.ts` to classify LIF fields as supported, passively preserved, or dropped.
- Local commands run on 2026-05-20 after `vdma-lif` integration:
  - `npm install vdma-lif@1.0.0-7 -w @agv/core`: installed the generated LIF package in `@agv/core`.
  - `npm ls vdma-lif --all`: `vdma-lif@1.0.0-7` installed under `@agv/core`.
  - `npm run build -w @agv/core`: passed.
  - `npm test -- packages/core/src/core.test.ts`: passed, 1 file and 9 tests.
  - `npm run build`: passed.
  - `npm test`: passed, 8 files and 28 tests.
  - `npm run architecture:check`: passed.
  - `env PLAYWRIGHT_WEB_PORT=6174 PLAYWRIGHT_API_PORT=4101 PLAYWRIGHT_MQTT_PORT=1885 npm run test:e2e`: passed, 1 Chromium smoke test.
