# Myriad figure package format

This document specifies the Myriad figure package: the data a host hands to the figure player so that it can draw and
animate a layered 2.5D figure. It is written for a third party implementing a reader or a writer.

The reference implementation is this repository, the package `@myriad-you/figure-player`. Where this document names a source file (for example
`src/anime25drig/types.ts`), that file is normative for anything this document leaves out. Where the two disagree,
report it: the disagreement is a defect in one of them.

> **Pre-release.** The player is before 1.0. The rules in §3 say how the format changes from here on.

## Contents

1. [Scope and terms](#1-scope-and-terms)
2. [Conventions](#2-conventions)
3. [Versioning and compatibility](#3-versioning-and-compatibility)
4. [Identity fields](#4-identity-fields)
5. [Playback content](#5-playback-content)
6. [Pose corrections](#6-pose-corrections)
7. [Atlas image](#7-atlas-image)
8. [Rig manifest and rig contract](#8-rig-manifest-and-rig-contract)
9. [Pose JSON](#9-pose-json)
10. [Changes from version 7 to version 8](#10-changes-from-version-7-to-version-8)

---

## 1. Scope and terms

A **package** consists of:

| Part | Form | Required | Notes |
|---|---|---|---|
| Playback document | JSON object | yes | Everything the player draws from: canvas, layers, anchors, profiles. §4–§6. Called "the playback" below. |
| Atlas image | PNG | yes | The single image the layers are cut from. §7. |
| Rig manifest | JSON object | no | A host may carry the playback inside it. On the server the playback is stored in the manifest's `anime25dPlayback` field. §8. |

Two further documents belong to the format:

- **Pose corrections** are not a separate document. They are a list inside the playback, at
  `shellProfile.poseCorrections` (§6).
- **Pose JSON** is a separate document that hosts exchange: one drawn frame of a figure, bound to the package it was
  taken of (§9).

What the reference player checks:

- `isAnime25DPlayback(value)` (`src/anime25drig/types.ts`) validates a whole playback document of any version the player
  reads. It returns a boolean and never throws. It checks every rule marked as a bound or invariant in §4–§6.
- The stage (`Anime25DStage`, and `FigurePlayer`, which wraps it) does **not** validate. It converts the playback to
  the form it holds internally by version (`readAnime25DPlayback`, `src/anime25drig/packageFormat.ts`). The conversion
  throws a `FigureError` for a version it does not read (`anime25dPlaybackVersion`, §3.2) and for a version 7 package
  not shaped as the conversion needs (`anime25dPlaybackInvalid`, §3.4), never a bare `TypeError`. A host must call
  `isAnime25DPlayback` before it hands a package to the stage. A package that fails it may crash the stage or draw
  wrongly.
- The player does not validate the rig manifest or the atlas image. Pose JSON is checked when it is drawn (§9).
- The server that stores packages validates only a subset (§1.2).

### 1.1 How the parts travel, and what they are written in

- Every JSON document of the format is UTF-8 text without a byte-order mark, as JSON (RFC 8259) requires for
  exchange. Object keys must be unique within an object; a document with a duplicate key is not a package of this
  format, and a reader may refuse it or keep either value (`JSON.parse` keeps the last). Writers never write one.
- On the server, a package is a directory named by its id (§1.3) holding two files: `atlas.png` (§7) and
  `manifest.json`, the rig manifest (§8) with the playback in its `anime25dPlayback` field and the atlas URL in
  `textures[0].url`. A host fetches the manifest, takes `anime25dPlayback` from it, and loads the atlas from that URL.
  The player needs the playback and the atlas URL; the manifest is optional to it (§8).
- Size limits: the playback's own bounds are in §5 (canvas at most 8192 a side, at most 128 layers, the mesh and
  outline limits of §5.12). The atlas is 256 to 8192 pixels on each side as the server stores it (§7). The format
  sets no limit on a document's size in bytes; hosts may set their own.

### 1.2 What the server validates

The server (`myriad-core`'s `anime25d_contract.rs`, called when a package is imported or rewritten) checks less than
a reader:

- identity and versions: `kind`, `version`, `engine` (version 7), `credits` (version 8), all as §4;
- `pixelCanvas` width and height positive and finite; `layers` a non-empty array; `anchors` an object;
- `mouthProfile`, `chestProfile` and `shellProfile` with every bound of §5.5–§5.7, and pose corrections as §6.

It does not check the layers, anchors, arm models, turn keyforms, `enhancement`, `partProfile`, `figureStance`, nor
version 7's `engineUrl`, `license` and `copyright` beyond their presence. A package the server accepts may still fail
`isAnime25DPlayback`; a reader must validate what it reads. The rules both check are pinned by one set of accept and
reject cases, `contracts/figure_package_conformance.json` (a copy of the server core's
`crates/conformance/v1/figure/package.json`), which both test suites run.

### 1.3 The package id

A stored package is named by its id: SHA-256, as 64 lowercase hex digits, over these bytes in order
(`rig_package_id` in the server core's `myriad-persona-sync`):

1. the ASCII bytes `myriad-rig-package-v1` and one zero byte;
2. the atlas file's length in bytes, as an unsigned 64-bit big-endian integer, then the atlas file's bytes;
3. the canonical manifest's length in bytes, the same way, then the canonical manifest.

The canonical manifest is the manifest as the server reads it (only the fields of §8; any other top-level field of
the manifest is not kept), with every `textures[i].url` replaced by `asset://atlas/` followed by that texture's `id`,
written as canonical JSON (`myriad-canonical`):

- no whitespace anywhere;
- object keys in the byte order of their UTF-8, at every depth (the playback inside included);
- strings escaped as serde_json escapes them: `"` and `\` and the control characters U+0000–U+001F escaped
  (`\b \f \n \r \t` by those names, the rest as `\u00XX` with lowercase hex), every other character (`/` and U+007F
  included) as its UTF-8;
- `null`, `true`, `false` as such;
- a number whose literal was an integer (no fraction, no exponent; within 64-bit integers) as its decimal digits, with
  `-` if negative; any other number as the shortest digits that read back to the same 64-bit float (serde_json's
  writer, `ryu`): when 1e-5 ≤ |x| < 1e16, or x is zero, as a plain decimal with at least one digit after the point
  (`0.0`, `-0.0`, `1.0`, `8.0` for a literal `80e-1`, `0.00001`, `1000000000000000.0`); otherwise as digits, `e`, a
  sign and the exponent, with a point only when there is more than one digit (`1e+16`, `1.2345678901234568e+20`,
  `1e-6`).

So the id depends on the values and on whether each number was written as an integer or not, never on the order of
keys or on whitespace. A reader that does not keep that distinction (JavaScript's `JSON.parse` does not) cannot
reproduce the id from what it parsed; it should keep the stored bytes when the id matters.

## 2. Conventions

### 2.1 Coordinates

Unless a field says otherwise, positions and lengths are in the pixel space of `pixelCanvas`:

- the origin is the top-left corner of the canvas;
- x grows to the right;
- y grows downward (a face's `y0` is above its `y1`; `neckTop` is above `neckBottom`);
- one unit is one canvas pixel. Values need not be integers.

Where a third axis is used (the arm model, §5.3.6), z points toward the viewer.

Some fields use **normalised** units relative to an ellipsoid or a box. Each such field says so.

### 2.2 Sides

`L` and `R` name sides **of the picture as seen**. `L` is the one on the viewer's left. This applies to layer `side`,
to joint names (`shoulderL` is the shoulder on the left of the picture), to `eyeL`/`eyeR`, to the driver fields `lidL`
and `lidR`, and to arm sides. It is not the figure's own left.

### 2.3 Numbers

- Every number is a JSON number. JSON has no NaN or Infinity, so every number in a playback document is finite. (Pose
  JSON writes non-finite numbers and −0 in a form of its own, §9.2.)
- Readers that validate objects already in memory should note that the reference validator's `isBetween` does not test
  for NaN separately. NaN still fails every bound, because every comparison with NaN is false. Infinity fails every
  bound because every bound is finite. Several other checks (`numberInRange` in `types.ts`, `finite` in
  `poseCorrections.ts`) also call `Number.isFinite` explicitly.
- Bounds in this document are inclusive unless stated otherwise.
- "Integer" means that `Number.isInteger` is true. A field that does not say "integer" accepts fractions.
- `W` and `H` stand for `pixelCanvas.width` and `pixelCanvas.height`.

### 2.4 Value kinds

The validator (`src/anime25drig/playbackValidation.ts`) uses these kinds throughout:

| Kind | Rule |
|---|---|
| coordinate | number in [−16384, 16384] (twice `MAX_PLAYBACK_EDGE` = 8192) |
| length | number in [0, 16384] |
| bone | number in [0.001, 16384]. A length the runtime divides by. |
| share | number in [0, 1] |
| along | number in [0, 4]. A place along a forearm: 0 the elbow, 1 the wrist, more than 1 past the wrist. |
| level | number in [0, 255] (a colour channel) |
| text(n) | a string, with `length` ≤ n in UTF-16 code units, that is not empty once ECMAScript's `trim()` has removed its leading and trailing WhiteSpace and LineTerminator characters (U+0009, U+000B, U+000C, U+0020, U+00A0, U+FEFF, the Zs characters, U+000A, U+000D, U+2028, U+2029). Used for the fields only a reader checks; a credit's `name` has its own rule (§4.2). |
| point(x, y) | an object whose two named members are coordinates |
| box | an object with `x0`, `y0`, `x1`, `y1` coordinates, `x1 ≥ x0` and `y1 ≥ y0`. The edges are the first and last pixels of what the box bounds, so a line one pixel thick has `y0 = y1`. |
| record | a non-null object that is not an array |

An array of a given length must have exactly that many elements. A sparse array, or one with a missing element, fails.

### 2.5 Unknown fields

A reader ignores every field that the package's version does not define, at any depth. The reference validator
accepts such fields. For example, a version 8 package carrying a stray `engine` field passes.

A writer must not put meaning into undefined fields. A later version may define the same name with another meaning
(§3). Converting between versions (§3.4) carries undefined fields unchanged; where one would collide with a field the
other version defines, it is moved or the conversion fails (§3.4), never dropped.

### 2.6 Absent and `null`

A field marked "optional" may be left out. It may not be `null` unless the field's type includes `null`.

The layer fields `phys`, `fade` and `side` accept either form for "none": the key may be absent or set to `null`. A
writer should write `null`, which is what the type declares.

---

## 3. Versioning and compatibility

### 3.1 The version field selects the rules

The top-level `version` field of the playback is the only thing that says which rules apply. A reader decides the
version from this field alone and never guesses it from which keys are present.

A version (this one and the sub-block versions of §3.3) is a JSON number whose value is a non-negative integer. It is
read by its value, however the literal is written: `8`, `8.0` and `80e-1` are all version 8. A string (`"8"`), a
fraction (`8.5`), `null` or a missing field is no version, and the package is refused. Writers write versions as
integer literals.

Versions defined by this document:

| `version` | `kind` | Status |
|---|---|---|
| 7 | `"anime-2.5d-rig"` | Frozen. **The version writers emit today.** |
| 8 | `"myriad-figure"` | Defined and read now. The current form the reference runtime holds every package in. |

> **Writers emit version 7.**
>
> Version 8 is defined, and readers read it now, so that readers ship before writers do. A writer may switch to
> emitting version 8 only once every reader it reaches reads version 8. That includes servers that validate uploaded or
> stored packages, other players, and tools. Until then, write version 7.
>
> A reader written today must read both 7 and 8.

### 3.2 Unknown versions

A reader refuses a package whose `version` it does not read. It does not fall back to the nearest version.

- `isAnime25DPlayback` returns `false`.
- `readAnime25DPlayback` and `writeAnime25DPlayback` throw a `FigureError` with code `anime25dPlaybackVersion` and
  params `version` (the value found, as a string) and `read` (the versions read, as `"7, 8"`). The English fallback
  message is `This figure package is of version {version}; this player reads versions {read}.`
- The list of versions read is exported as `ANIME25D_PLAYBACK_VERSIONS_READ` (`[7, 8]`, oldest first).

### 3.3 Fixed sub-block versions

Some sub-blocks carry a `version` of their own. Within each package version these values are fixed. They are not
independent version numbers:

| Block | `version` in package 7 and 8 |
|---|---|
| `mouthProfile` | 1 |
| `chestProfile` | 2 |
| `shellProfile` | 1 |
| `partProfile` | 1 |

A package with any other value fails validation.

### 3.4 Rules for change

1. Any change to a field's meaning, unit, bounds that rejects something accepted before, or a renamed key, needs a new
   package version.
2. A version, once defined, is frozen. Its rules do not change.
3. A reader keeps reading every version it read before.
4. Converting between versions renames only. Every field keeps its place and its value. The reference conversion is
   `readAnime25DPlayback` (any version read → version 8) and `writeAnime25DPlayback(playback, version)` (version 8 →
   7 or 8) in `src/anime25drig/packageFormat.ts`.

The conversion between 7 and 8 does this:

- The identity fields (§4) are replaced by the other version's identity (mapped as §4.3). The new identity is written
  where `kind` was, in the order `kind`, `version`, then the rest of that version's identity; with no `kind`, it comes
  first. The source version's other identity fields are removed wherever they were.
- The `at` keys of every pose correction are renamed (§6.3). Each key keeps its place within `at`. Everything else in
  `shellProfile` keeps its place.
- Every other field is the same value, in the same place. Nothing is dropped:
  - a version 7 document's own `credits` field (version 7 does not define it) is carried in the current form as
    `credits@7`, and written back as `credits` in version 7; a version 7 document that already has a `credits@7`
    cannot be read (`anime25dPlaybackUnconvertible`);
  - writing version 7 fails (`anime25dPlaybackUnconvertible`, params `version` 7 and `field`) when the package has
    `engine`, `engineUrl`, `license` or `copyright` fields of its own, or credits version 7 cannot hold (§4.3).
- Reading version 7 fails with `anime25dPlaybackInvalid` (param `field`, the path of what is wrong) when the document is
  not an object, its `engine` is not a string, its `engineUrl`, `license` or `copyright` is present but not a string,
  its `shellProfile` is not an object, its `poseCorrections` is present but not an array, or a correction or its `at`
  is not an object. Nothing else is checked; that is `isAnime25DPlayback`'s.

So version 7 → 8 → 7 gives the same value: every key with the same value, and a JavaScript reader's `JSON.stringify`
of it the same text when the version 7 document had its identity first (`kind`, `version`, `engine`, then whichever of
`engineUrl`, `license`, `copyright` are present), as the reference writer lays it out. A document with its keys in
another order (the server's store keeps keys sorted, §1.3) comes back with its identity where `kind` was, so the same
value in a different key order. The package id (§1.3) does not depend on key order.

Converting version 8 → 8 returns the document itself.

---

## 4. Identity fields

### 4.1 Version 7

| Field | Type | Required | Rule |
|---|---|---|---|
| `kind` | string | yes | exactly `"anime-2.5d-rig"` |
| `version` | number | yes | 7 (§3.1) |
| `engine` | string | yes | exactly `"Anime2.5DRig"` |
| `engineUrl` | string | no | `length` ≤ 512. May be empty. |
| `license` | string | no | `length` ≤ 512. May be empty. |
| `copyright` | string | no | `length` ≤ 512. May be empty. |

These fields credit the reference project as its MIT licence requires. That requirement is why they are kept.
Version 7 is frozen. The reference writer persists them as these literals (`src/anime25drig/credit.ts`):

| Field | Value |
|---|---|
| `engine` | `Anime2.5DRig` |
| `engineUrl` | `https://github.com/852wa/Anime2.5DRig` |
| `license` | `MIT` |
| `copyright` | `Copyright (c) 2026 hakoniwa` |

The server does not check `engineUrl`, `license` or `copyright` (§1.2); a reader does.

### 4.2 Version 8

| Field | Type | Required | Rule |
|---|---|---|---|
| `kind` | string | yes | exactly `"myriad-figure"` |
| `version` | number | yes | 8 (§3.1) |
| `credits` | array of credit | yes | 1 to 16 entries |

A **credit** is a record:

| Field | Type | Required | Rule |
|---|---|---|---|
| `name` | string | yes | at most 512 UTF-16 code units; not blank |
| `url` | string | no | at most 512 UTF-16 code units. May be empty. |
| `license` | string | no | at most 512 UTF-16 code units. May be empty. |
| `copyright` | string | no | at most 512 UTF-16 code units. May be empty. |

Lengths count UTF-16 code units (a character outside the Basic Multilingual Plane counts 2). A `name` is **not blank**
when at least one of its characters is neither Unicode `White_Space` nor U+FEFF; so `"\u0085"`, `"\uFEFF"` and
`"\u00A0\u3000"` are blank, and `"\u200B"` is not. A present `url`, `license` or `copyright` must be a string; `null`
is refused.

`credits` is required, so the attribution travels with every package of version 8. It lists the works the package is made with. For each work it keeps what that work's licence requires a copy
to keep. For a work under the MIT licence, that is the copyright notice and the licence. `license` holds the licence's
name.

A writer of version 8 credits the reference project in `credits`, one entry whose `name` is `"Anime2.5DRig"` and
whose `url`, `license` and `copyright` are the literals of §4.1.

`engine`, `engineUrl` and the top-level `license` and `copyright` are not part of version 8. A reader of version 8
ignores them (§2.5).

### 4.3 Mapping

Reading version 7 (version 7 → 8):

| Version 7 | Version 8 |
|---|---|
| `engine` | `credits[0].name` |
| `engineUrl` | `credits[0].url` |
| `license` | `credits[0].license` |
| `copyright` | `credits[0].copyright` |

`credits` has exactly that one entry. A version 7 field that is absent leaves the matching credit field absent.

Writing version 7 (version 8 → 7):

| Version 8 | Version 7 |
|---|---|
| `credits[0].name`, which must be `"Anime2.5DRig"` | `engine` |
| `credits[0].url` | `engineUrl` |
| `credits[0].license` | `license` |
| `credits[0].copyright` | `copyright` |

Version 7 holds exactly one credit, the reference project's. A package whose `credits` is not exactly one entry named
`"Anime2.5DRig"` with no fields besides `name`, `url`, `license` and `copyright` cannot be written in version 7: the
conversion fails with `anime25dPlaybackUnconvertible` (`field`: `credits`, or `credits.0.<field>`) rather than drop a
credit. Absent credit fields are left out.

---

## 5. Playback content

Both versions hold the same content besides their identity. The only exception is the keys of pose-correction axes
(§6.3). The top-level fields are:

| Field | Type | Required | Section |
|---|---|---|---|
| `pixelCanvas` | record | yes | §5.1 |
| `layers` | array | yes | §5.3 |
| `anchors` | record | yes | §5.4 |
| `mouthProfile` | record | yes | §5.5 |
| `chestProfile` | record | yes | §5.6 |
| `shellProfile` | record | yes | §5.7 |
| `turnKeyforms` | record | no | §5.8 |
| `bodyTurnKeyforms` | record | no | §5.8 |
| `enhancement` | record | no | §5.9 |
| `partProfile` | record | no | §5.10 |
| `figureStance` | string | no | §5.11 |

Package-wide limits that span several blocks are collected in §5.12.

Some fields are validated but not read by the reference player. They are marked "not read by the player". A writer
must still give them within bounds.

### 5.1 `pixelCanvas`

| Field | Type | Rule | Meaning |
|---|---|---|---|
| `width` | number | [1, 8192] | Canvas width in pixels (`W`) |
| `height` | number | [1, 8192] | Canvas height in pixels (`H`) |

This is the space every coordinate is given in (§2.1). The limit of 8192 is `MAX_PLAYBACK_EDGE`. The validator's
comment explains it: the bounds are the import tool's own, with room. A document is at most 4096 a side, and a standing
figure's frame is at most half as wide again, with a height up to 16/9 of its width.

A **standing figure** (a full body down to its soles) is a package whose `anchors.groundY` is present. A **bust** is
one without it. Several fields behave differently on a standing figure, and each says so.

### 5.2 Drawing order

Layers are drawn in array order: the first layer is drawn first, at the back. Each later layer is drawn over the ones
before it. On a standing figure the player may swap the order of the two legs from frame to frame. A layer's `z`
(§5.3) does not reorder drawing.

### 5.3 `layers`

An array of 1 to 128 layers. The maximum is the rig contract's `limits.maxParts` (`MAX_RIG_PARTS`, 128 in
`contracts/merope_rig_contract.json`). Each layer is a record:

| Field | Type | Required | Rule |
|---|---|---|---|
| `name` | string | yes | text(512) |
| `role` | string | yes | text(64) |
| `z` | number | no | coordinate |
| `depth` | number | yes | [0, 4] |
| `group` | string | yes | `"head"` or `"body"` |
| `phys` | `"hair"` or `null` | yes, may be absent (§2.6) | |
| `fade` | fade name or `null` | yes, may be absent (§2.6) | one of §5.3.2 |
| `side` | `"L"`, `"R"` or `null` | yes, may be absent (§2.6) | |
| `x` | number | yes | coordinate |
| `y` | number | yes | coordinate |
| `w` | number | yes | [0.5, 8192] |
| `h` | number | yes | [0.5, 8192] |
| `atlas` | record | yes | §5.3.3 |
| `strands` | array | yes | §5.3.4. May be empty. |
| `synthetic` | boolean | no | the type declares only `true`. The validator accepts `false`. |
| `armVariant` | record | no | §5.3.5 |

Meaning of each field:

- **`name`**: the layer's name as drawn, usually the name of the layer in the source drawing. When `role` is
  `"unknown"`, the role is resolved from the name (§5.3.1). `partProfile` refers to layers by name (§5.10). The
  reference player gives the names `part:<index>:<part name>` to pieces it cuts out of layers itself. A package layer
  should not use a name of that form, because it would be taken for that part. Names should be unique within
  `layers`: the validator does not require it, but where the player looks a layer up by name (`partProfile`, a gesture
  arm's hand) it takes the first layer, in array order, with that name.
- **`role`**: what the layer depicts (§5.3.1). Most of the runtime's behaviour is chosen by role.
- **`z`**: the layer's place in the original drawing's stacking order. It does not reorder drawing (§5.2). The
  player uses it where it compares two layers' stacking, for example whether a head ornament lies over the front hair,
  or whether a garment lies over a leg. It also seeds a per-layer motion phase. When absent, the layer's index in
  `layers` stands in.
- **`depth`**: the layer's depth for head-turn parallax. 1 is the plane of the face. Greater than 1 is nearer the
  viewer, less than 1 is further away. The head-turn offsets scale with `depth − 1`. For example, the horizontal offset
  at full `headYaw` is `faceScale · (14 + 40·(depth − 1) + 0.028·neckPivot.y)` pixels for a layer that follows the head
  fully (`src/anime25drig/layerTransform.ts`). The shell surfaces (§5.7) use the same `depth − 1` for relief. The import
  tool's conventional depths per role are listed in §5.3.1.
- **`group`**: `"head"` layers move with the head (turn, nod, roll). `"body"` layers move with the body and follow the
  head only slightly. The player replaces `group` from the role (§5.3.1), so for a known role `group` is implied.
- **`phys`**: `"hair"` marks a layer as hair driven by strand physics. With strands (§5.3.4) it swings and hangs.
  `null` means no hair physics.
- **`fade`**: the expression channel that controls the layer's opacity (§5.3.2). `null` means the layer is always
  shown.
- **`side`**: the side of the picture the layer belongs to (§2.2). This matters for paired features, for example an
  eye's drawings, a brow, an ear ornament, a gesture arm, or a leg. A layer with fade `eyeOpen` or `eyeClose` and no
  side is driven as if it were `R`. Writers should give eye layers a side.
- **`x`, `y`, `w`, `h`**: the rectangle the layer occupies on the canvas at rest, in canvas pixels. Its top-left corner
  is (`x`, `y`). It may lie partly off the canvas, within the coordinate bounds.
- **`atlas`**: where the layer's picture is in the atlas image (§5.3.3).
- **`strands`**: the hair strands of a hair lock (§5.3.4).
- **`synthetic`**: the layer was drawn by the import tool, not by the artist, and the runtime may redraw it. The
  reference player uses this for the speaking mouth. For each of the fades `mouthOpen`, `mouthWide`, `mouthRound` and
  `mouthNarrow` it looks at the first layer (in array order) with that fade; it draws those mouths live when there is
  a `mouthOpen` layer, each of those first layers that exists is synthetic, and the first `mouthClose` layer's pixels
  can be read. Later layers with the same fade are not looked at. (This is how the reference player has always
  decided it; changing it to every layer would change how existing packages with a second, drawn mouth play, so the
  format states the rule as it is. A writer gives each mouth fade one layer.)
- **`armVariant`**: present on a gesture-arm layer (§5.3.5).

#### 5.3.1 Roles and their resolution

`role` is a free string of at most 64 characters. The validator does not restrict it to a list. The runtime recognises
the roles below. The table also gives the import tool's conventional `depth` and `fade` for each role
(`ANIME25D_LAYER_DESCRIPTORS` in `src/rig/anime25d.ts`). The player reads `depth` and `fade` from the layer, not from
this table.

| Role | Group | Conventional depth | Conventional fade |
|---|---|---|---|
| `back-hair` | head | 0.55 | — |
| `bottomwear` | body | 0.88 | — |
| `legwear` | body | 0.87 | — |
| `footwear` | body | 0.87 | — |
| `collar-back` | body | 0.94 | — |
| `neck` | body | 0.95 | — |
| `collar-front` | body | 0.955 | — |
| `topwear` | body | 0.9 | — |
| `handwear` | body | 0.86 | — |
| `arm-variant` | body | 0.86 | `armVariant` |
| `arm-variant-hand` | head | 0.86 | `armVariant` |
| `earwear` | head | 0.97 | — |
| `neckwear` | body | 1 | — |
| `eyewear` | head | 1.16 | — |
| `wings` | body | 1 | — |
| `tail` | body | 1 | — |
| `objects` | the layer's own `group` | 1 | — |
| `ears` | head | 0.96 | — |
| `face` | head | 1 | — |
| `facedetail` | head | 1.02 | — |
| `lovestruck-face-effect` | head | 1.04 | `lovestruckFace` |
| `accent-blush` | head | 1.035 | `accentBlush` |
| `maniac-eye-shadow` | head | 1.04 | `maniacEyeShadow` |
| `maniac-mouth-shadow` | head | 1.07 | `maniacMouthShadow` |
| `headwear` | head | 1.2 | — |
| `mouth-close` | head | 1.08 | `mouthClose` |
| `mouth-open` | head | 1.08 | `mouthOpen` |
| `mouth-wide` | head | 1.08 | `mouthWide` |
| `mouth-round` | head | 1.08 | `mouthRound` |
| `mouth-narrow` | head | 1.08 | `mouthNarrow` |
| `mouth-cry` | head | 1.08 | `mouthCry` |
| `mouth-maniac` | head | 1.08 | `mouthManiac` |
| `mouth-silly` | head | 1.08 | `mouthSilly` |
| `lovestruck-drool` | head | 1.09 | `lovestruckDrool` |
| `nose` | head | 1.15 | — |
| `eyewhite` | head | 1.06 | `eyeOpen` |
| `eyebrow` | head | 1.14 | — |
| `irides` | head | 1.08 | `eyeOpen` |
| `lovestruck-heart` | head | 1.1 | `lovestruckHeart` |
| `eyelash` | head | 1.12 | `eyeOpen` |
| `eye-close` | head | 1.12 | `eyeClose` |
| `eye-close2` | head | 1.12 | `eyeClose` |
| `eye-dizzy` | head | 1.12 | `eyeDizzy` |
| `eye-squeeze` | head | 1.12 | `eyeSqueeze` |
| `eye-cry` | head | 1.12 | `eyeCry` |
| `eye-silly-white` | head | 1.12 | `eyeSilly` |
| `iris-silly` | head | 1.13 | `eyeSilly` |
| `front-hair` | head | 1.28 | — |
| `anger-mark` | head | 1.3 | `angerMark` |
| `speechless-sweat` | head | 1.3 | `speechlessSweat` |
| `accent-music-notes` | head | 1.3 | `accentNotes` |
| `accent-question` | head | 1.3 | `accentQuestion` |
| `accent-sleep` | head | 1.3 | `accentSleep` |
| `accent-sparkle` | head | 1.3 | `accentSparkle` |

`unknown` is a reserved role: "resolve from the name".

The player resolves each layer before it meshes or draws it, with `resolveAnime25DLayerSemantics`
(`src/rig/anime25dLayerSemantics.ts`). The validator's mesh check (§5.12) resolves layers the same way. Resolution
works as follows:

1. **Role.** If `role` is `"unknown"`, the name is normalised:
   1. Unicode NFKC, trimmed, lower-cased.
   2. A trailing `copy` or `のコピー`, optionally followed by whitespace and digits, is removed together with any
      whitespace before it (the regular expression `\s*(?:のコピー|copy)(?:\s*\d+)?$`, Unicode-aware). No space is
      needed before it: `hair copy 2`, `haircopy` and `hairのコピー3` all become `hair`.
   3. Runs of whitespace (any Unicode whitespace, `\s`) and underscores become `-`, and repeated `-` collapse to one.
   4. `eyelash-c` becomes `eye-close`. `mouth-c` becomes `mouth-close`. `mouth`, and `mouth` followed by digits
      (optionally after `-`), become `mouth-open`. `レイヤー-1` becomes `facedetail`.
   5. A trailing run of `-<digits>`, `-l`, `-r`, `-left`, `-right`, `-top` or `-bottom` fragments is set aside as
      the suffix. The rest is the base.
   6. The base is replaced by its alias, if it has one: `hair`, `hairf` → `front-hair`; `hairb` → `back-hair`;
      `eyes` → `eyelash`; `eyer` → `eyelash-r`; `eyel` → `eyelash-l`; `browr` → `eyebrow-r`; `browl` → `eyebrow-l`;
      `earr` → `ears-r`; `earl` → `ears-l`; `eyebg` → `eyewhite`; `eyeclose` → `eye-close`; `eyeclose2` →
      `eye-close2`; `necklace`, `pendant`, `amulet` → `neckwear`; `glasses`, `goggles` → `eyewear`; `earrings`,
      `ear-ornament` → `earwear`; `hairclip`, `hairpin`, `hair-ornament` → `headwear`.
   7. The base of the result is split from its suffix again. If that base is a role in the table above, it becomes
      the role. Otherwise the role stays `"unknown"`.

   A role other than `"unknown"` is kept as given.
2. **Group.** The group is then set from the resolved role:
   - `neck`, `neckwear`, `topwear`, `bottomwear`, `legwear`, `footwear`, `handwear`, `arm-variant`, `collar-front`,
     `collar-back`, `wings` and `tail` → `"body"`;
   - `objects`, and any role not in the table (including `"unknown"`) → the layer's own `group`;
   - every other role in the table → `"head"`.

   This applies to every layer, not only to those with role `"unknown"`. A layer with role `face` and group `"body"`
   is drawn as a head layer.

#### 5.3.2 Fade names

`fade` is one of these 27 names, or `null`:

| Fade | Shown by |
|---|---|
| `eyeOpen` | the eye's openness (`lidL`/`lidR` by `side`), less any eye variant shown |
| `eyeClose` | one less the eye's openness, less any eye variant shown. With role `eye-close2`, an alternative closed-eye drawing. |
| `eyeDizzy` | `eyeDizzy` |
| `eyeSqueeze` | `eyeSqueeze` |
| `eyeCry` | `eyeCry` |
| `eyeSilly` | `silly` |
| `lovestruckHeart` | `lovestruck`, per side |
| `lovestruckFace` | `lovestruck` |
| `lovestruckDrool` | `lovestruck` |
| `maniacEyeShadow` | `maniac` |
| `maniacMouthShadow` | `maniac` |
| `angerMark` | `anger` |
| `speechlessSweat` | `speechless` |
| `accentNotes` | `accentNotes` |
| `accentQuestion` | `accentQuestion` |
| `accentSleep` | `accentSleep` |
| `accentSparkle` | `accentSparkle` |
| `accentBlush` | `accentBlush` |
| `mouthOpen` | the mouth mix (one of the mouth shapes) |
| `mouthWide` | the mouth mix |
| `mouthRound` | the mouth mix |
| `mouthNarrow` | the mouth mix |
| `mouthClose` | the mouth mix |
| `mouthCry` | the crying mouth |
| `mouthManiac` | the mouth mix and `maniac` |
| `mouthSilly` | the silly mouth |
| `armVariant` | never shown as a plain layer. The gesture-arm presenter shows it (§5.3.5). |

The second column names driver fields (§9.4). The exact opacity formulas, including how variants hide one another,
are `fadeOpacityFromFrame` in `src/anime25drig/mouthRuntime.ts`. They are runtime behaviour, not format.

#### 5.3.3 `atlas`: the layer's cut of the atlas

| Field | Type | Rule |
|---|---|---|
| `x` | number | share: [0, 1] |
| `y` | number | share: [0, 1] |
| `w` | number | share, and `w > 0` |
| `h` | number | share, and `h > 0` |

Invariants:

- `x + w ≤ 1 + 1e-6`
- `y + h ≤ 1 + 1e-6`

The rectangle is given as fractions of the atlas image's width and height. Its origin is the top-left of the image
and y grows downward (§7). The cut is stretched linearly over the layer's canvas rectangle. A canvas point
(`px`, `py`) inside the layer's rectangle samples the atlas at

```
u = atlas.x + (px − x) / w · atlas.w
v = atlas.y + (py − y) / h · atlas.h
```

so the cut's size in atlas pixels need not equal `w` × `h`. Several layers may share or overlap cuts. The sum of
`atlas.w · atlas.h` over all layers is limited (§5.12).

#### 5.3.4 `strands`

An array of at most 32 strands. Each strand is a record:

| Field | Type | Rule | Meaning |
|---|---|---|---|
| `x` | number | coordinate | the strand's position across, in canvas pixels |
| `rootY` | number | coordinate | where it grows from |
| `tipY` | number | coordinate | where it ends |

Invariant: `x` is strictly increasing along the array, so strands run left to right and no two share an `x`.

Strands give a hair lock its physics. Vertices are weighted to nearby strands by their distance across, and the median
gap between strands sets that distance. Each strand's length relative to the face height sets how it swings. An empty
array means the layer has no strand dynamics. On a hair layer whose shell hairline pin uses `strand-roots` mode
(§5.7.3), the strands' `rootY` also places the pinned hairline.

#### 5.3.5 `armVariant`

Present on a gesture-arm layer: a drawn arm that rises in when the figure gestures.

| Field | Type | Required | Rule |
|---|---|---|---|
| `gesture` | string | yes | text(64). The gesture the arm draws. The reference driver's gestures are `wave`, `point`, `chest` and `chin` (driver fields `handWaveL`, `handPointL`, …). |
| `lift` | string | yes | `"whole"` or `"shoulder"` |
| `model` | record | no | §5.3.6. Without it, the arm is raised in flat. |

- `lift: "whole"` moves the layer as one piece, for a hand raised clear of the body.
- `lift: "shoulder"` holds the layer at the shoulder and lifts the hand most, for an arm folded across the body.

Such layers conventionally have role `arm-variant`, fade `armVariant`, and a `side`.

#### 5.3.6 Arm model (`Anime25DArmModel`)

The arm as a 3D model, with the drawing serving only as its texture. Its coordinates are **layer-local pixels**: the
origin is the layer's (`x`, `y`) corner, the scale is canvas pixels, x is right, y is down, and z is toward the viewer.
Below, `w` and `h` are the owning layer's `w` and `h`, and `n` is the length of `radius`.

| Field | Type | Required | Rule | Meaning |
|---|---|---|---|---|
| `trialPixel` | number | no | [0.001, 64] | Document pixels per reference pixel. A reference pixel is one pixel of a bust drawn 540 wide, and the arm's drawn sizes (outlines, gaps it fills) are given in reference pixels. Absent on a bust, where it is `W / 540`. |
| `restHand` | array | no | hand (below) | A standing figure's hand as the portrait draws it hanging. Absent on a bust. |
| `drawnRadius` | number[] | no | exactly `n` bones | A standing figure's sleeve as wide as drawn, where that is wider than `radius`. |
| `shortSleeve` | number | no | share | Where a short sleeve ends along the arm (shoulder 0, elbow 0.5, wrist 1). |
| `restFore` | number | no | bone | A standing figure's forearm length as drawn hanging. |
| `restCuff` | number | no | along, and ≥ 0.1 | Where the hanging sleeve ends along that forearm (elbow 0, wrist 1). |
| `cuffFrom` | number | no | along | Where the hanging sleeve's cuff begins. |
| `upper` | number | yes | bone | Upper-arm length |
| `fore` | number | yes | bone | Forearm length |
| `radius` | number[] | yes | 2 to 256 bones | The sleeve's radius at evenly spaced places, shoulder to elbow, then elbow to cuff |
| `cuff` | number | yes | along | Where the drawn sleeve ends on the raised forearm. Bare skin lies past it. |
| `bare` | number | no | bone | Half the drawn bare forearm's width past the cuff. Absent when none shows. |
| `bareShift` | number | yes | coordinate | How far the bare forearm's middle lies off the elbow–wrist line, across it on screen |
| `restEnd` | number | yes | share | When raised, how far down the upper arm (shoulder 0, elbow 0.5) the portrait's own sleeve is worn |
| `restBand` | [number, number] | no | 2 shares | A band of the portrait's sleeve (shoulder 0, elbow 0.5) that every gesture draws at the wrist instead. It is worn only while the arm hangs. |
| `restReach` | array | yes | exactly `n` entries, each `null` or [length, length] | Hanging, how far the drawn arm reaches either side of the bone at the radius's places. The positive side is along (−dy, dx) of the bone direction. `null` where off the arm. |
| `rest` | joints | yes | below | The portrait's arm, hanging |
| `raised` | joints | yes | below | The gesture's arm |
| `hand` | array | yes | hand | The gesture's hand |
| `fingers` | number[] | yes | exactly 5 lengths | Half each finger's drawn width, thumb first. 0 when not drawn. |
| `fingerProfile` | number[][] | yes | at most 5 arrays of 0 to 256 lengths | Each finger's drawn half-width at nine places, knuckle to tip. Empty when not measured. |
| `keyProfile` | number[][] | yes | as `fingerProfile` | The same, with implausible measurements left empty |
| `palmOutline` | array or `null` | yes | `null`, or 3 to 256 points [a, b], each in [−64, 64] | The drawn palm's outline in the palm's frame: wrist + a·(middle knuckle − wrist) + b·(the same length across the palm, toward the little finger) |
| `hiddenFingers` | number[] | yes | at most 5 integers, each in [0, 4] | Fingers the drawn hand hides behind itself. The thumb is 0. |
| `skin` | [r, g, b] | yes | 3 levels | Skin colour, 0–255 per channel |
| `shade` | [r, g, b] | yes | 3 levels | Shade colour |
| `line` | [r, g, b] | yes | 3 levels | Line colour |
| `handOutline` | rings | yes | rings | The hand's own cut (skin and lines, no sleeve) |
| `armOutline` | rings | yes | rings | The gesture's arm within the layer. The rest of the layer is body the portrait's arm left bare. |
| `ground` | rings | no | rings | The drawing's empty ground about its upper arm and elbow. Absent when not measured. |

Sub-kinds used above:

- **joints**: a record with `shoulder`, `elbow` and `wrist`. Each is an array of exactly 3 coordinates [x, y, z].
- **hand**: exactly 21 points, each an array of exactly 2 coordinates: point 0 the wrist, then four points for each
  finger from its root to its tip, thumb first: 1–4 the thumb, 5–8 the index finger, 9–12 the middle finger, 13–16
  the ring finger, 17–20 the little finger (so point 9 is the middle finger's knuckle). Invariant: the distance from point 0 to point 9 is a bone,
  that is in [0.001, 16384]. The modelled hand is scaled by that distance.
- **rings**: an array of at most 256 rings, filled with the even-odd rule. Each ring is an array of points. Each point
  is an array of exactly 2 numbers [x, y], with x in [−2·w, 3·w] and y in [−2·h, 3·h]: a ring may reach past its
  layer by twice the layer's size. Across all rings of one field there are at most 16384 points. A ring may be empty.

Cross-field invariants:

- `drawnRadius` (when present) and `restReach` have the same length as `radius`.
- The `ground` rings of all layers together are limited in area (§5.12).

### 5.4 `anchors`

All positions are canvas pixels.

| Field | Type | Required | Rule | Meaning |
|---|---|---|---|---|
| `face` | box + `cx`, `cy` | yes | box with `x1 > x0` and `y1 > y0` strictly; `cx`, `cy` coordinates | The face's bounds and centre. The face's size scales the head's meshes and turns. `cy` is the face centre line for nod parallax. |
| `mouth` | box + `cx`, `cy` | yes | box (may be zero-sized); `cx`, `cy` coordinates | The mouth's bounds and centre |
| `neckPivot` | point(`x`, `y`) | yes | | The point the head rolls about |
| `neckTop` | number | yes | coordinate | The y of the neck's top |
| `neckBottom` | number | yes | coordinate | The y of the neck's base, where the shoulders begin. On a standing figure it is also the neck base of the skeleton. |
| `bodyPivot` | point(`x`, `y`) | yes | | The point the body leans about. On a standing figure it is the hips. |
| `groundY` | number | no | coordinate | A standing figure's soles. Its presence makes the package a standing figure (§5.1). A bust leaves it out. |
| `skeleton` | record | no | below | Joints found on the master portrait |
| `faceScale` | number | yes | [0.001, 64] | Dimensionless. Fixed pixel amplitudes of head and face motion are multiplied by it, for example the head-turn offset (§5.3, `depth`), the mouth's moves, and the breathing offset. The reference size these amplitudes are calibrated for is not specified by this document. |
| `eyeL` | eye | no | below | The eye on the left of the picture |
| `eyeR` | eye | no | below | The eye on the right of the picture |

The validator does not require `neckTop ≤ neckBottom`. In practice the neck's top lies above its base.

**eye**: a box (`x0`, `y0`, `x1`, `y1`, with `x1 ≥ x0` and `y1 ≥ y0`), plus:

| Field | Rule | Meaning |
|---|---|---|
| `icx`, `icy` | coordinates | The iris's centre. The iris scales about it, and gaze and keyed turns move it. |
| `closeY` | coordinate | The y the lid closes toward. A closing eye's drawing is squashed toward this line. |

**skeleton**:

| Field | Type | Rule |
|---|---|---|
| `model` | string | text(512). Names the pose model that found the joints. Not read by the player. |
| `joints` | record | Each key is a joint name. Each value is a record with `x`, `y` (coordinates, canvas pixels) and `score` in [0, 16] (the model's confidence; not read by the player). |

Joint names: `nose`, and each of `eye`, `ear`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`, `bigToe`,
`smallToe`, `heel` followed by `L` or `R`. That gives 23 names, sided as in §2.2. Any other key fails validation. Only
joints seen clearly and inside the frame should be listed. Each one listed replaces a proportion the rig would
otherwise assume (shoulders, elbows and wrists for arms, legs and feet for a standing figure).

### 5.5 `mouthProfile`

| Field | Type | Rule |
|---|---|---|
| `version` | number | exactly `1` |
| `source` | string | `"alpha-contour"` or `"bounds-fallback"`. Records how the silhouettes were measured. Not read by the player. |
| `silhouettes` | array | exactly 6 |
| `bridges` | array | exactly 15 |

The mouth **materials** are `mouthClose`, `mouthOpen`, `mouthWide`, `mouthRound`, `mouthNarrow` and `mouthManiac`.

**Silhouette**: the measured shape of one material's drawing.

| Field | Rule | Meaning |
|---|---|---|
| `material` | a material | |
| `centerX` | [−W, 2·W] | Centre, canvas pixels |
| `centerY` | [−H, 2·H] | |
| `width` | [0.25, W] | Size, canvas pixels |
| `height` | [0.25, H] | |
| `leftCornerY` | [−H, 2·H] | Corner heights. Not read by the player. |
| `rightCornerY` | [−H, 2·H] | |
| `fillRatio` | [0, 1] | Not read by the player |
| `aperture` | [0, 4] | |

Invariant: each of the 6 materials appears exactly once.

The player reads the `height` of `mouthOpen` and of `mouthRound` to size the jaw's travel.

**Bridge**: how the mouth is tuned while it passes between two materials.

| Field | Rule | Meaning |
|---|---|---|
| `first` | a material | |
| `second` | a material, and not equal to `first` | |
| `widthScale` | [0.75, 1] | Width multiplier at the midpoint of the transition |
| `heightScale` | [0.65, 1] | Height multiplier there |
| `neutralization` | [0, 1] | How much the shape is neutralised there |
| `centerOffsetX` | [−W/4, W/4] | Centre offset there, canvas pixels |
| `centerOffsetY` | [−H/4, H/4] | |

Invariant: the 15 bridges are the 15 unordered pairs of distinct materials, each exactly once. A bridge applies in
both directions, so (`mouthOpen`, `mouthWide`) and (`mouthWide`, `mouthOpen`) are the same pair and cannot both
appear.

### 5.6 `chestProfile`

| Field | Type | Rule | Meaning |
|---|---|---|---|
| `version` | number | exactly `2` | |
| `enabled` | boolean | | Whether the chest moves at all |
| `source` | string | `"ai-vision"`, `"geometry-fallback"` or `"gender-policy"` | How the profile was made. When `enabled` and not `"ai-vision"`, the player weights the chest from the rig manifest's geometry, if one is given (§8). |
| `centerX` | number | [0, W] | Chest region centre, canvas pixels |
| `centerY` | number | [0, H] | |
| `radiusX` | number | [1, W/2] | Chest region radii, canvas pixels |
| `radiusY` | number | [1, H/2] | |
| `visibleScale` | number | [0, 1] | How visible the chest's motion is |
| `motionScale` | number | [0, 1.25] | Amplitude multiplier |
| `frequencyScale` | number | [0.75, 1.25] | Frequency multiplier |
| `supportScale` | number | [0, 1] | How supported (held) the chest is |
| `garmentMotionScale` | number | [0, 1] | How much the garment moves with it |
| `confidence` | number | [0, 1] | Not read by the player |

The exact use of the scales is in `src/anime25drig/chestPhysics.ts` and `chestField.ts`. Their meaning beyond the bounds
is not specified by this document.

### 5.7 `shellProfile`

The shell is the 3D surface the head and hair turn on.

| Field | Type | Required | Rule | Meaning |
|---|---|---|---|---|
| `version` | number | yes | exactly `1` | |
| `source` | string | yes | `"anchor-derived"` or `"authored"` | |
| `enabled` | boolean | yes | | Whether the shell deforms anything. Pose corrections apply only when it is `true`. |
| `blend` | number | yes | [0, 1] | How much of the shell projection a point takes |
| `head` | ellipsoid | yes | §5.7.1 | |
| `faceProfile` | record | yes | §5.7.2 | |
| `hair` | ellipsoid + hair fields | yes | §5.7.3 | |
| `torso` | record | yes | §5.7.4 | |
| `poseCorrections` | array | no | §6 | Absent means the package has no pose corrections |

**Shell surface of a layer.** Each head-group layer (after resolution, §5.3.1) is on one of three surfaces. Role
`back-hair` is on `back-hair`. Roles `front-hair` and `headwear` are on `front-hair`. Every other head layer is on
`head`. Body layers are on none.

#### 5.7.1 Ellipsoid

Used by `head` and `hair`. All values are canvas pixels.

| Field | Rule |
|---|---|
| `centerX` | [0, W] |
| `centerY` | [0, H] |
| `radiusX` | [1, W] |
| `radiusY` | [1, H] |
| `radiusZ` | [1, W] (depth radius, toward the viewer) |

**Head radii** below means a position normalised by `head`: (`(x − head.centerX) / head.radiusX`,
`(y − head.centerY) / head.radiusY`). A displacement in head radii is multiplied by `radiusX` and `radiusY` to give
pixels.

#### 5.7.2 `faceProfile`

The face's relief down its middle: nose, brow, mouth.

| Field | Rule | Meaning |
|---|---|---|
| `enabled` | boolean | When false, the relief is a constant `0.55·(depth − 1)` |
| `startY` | [0, H] | Canvas y where the curve starts |
| `endY` | [0, 1.2·H], and `endY > startY` | Canvas y where the curve ends |
| `points` | exactly 5 points | |

Each point:

| Field | Rule | Meaning |
|---|---|---|
| `v` | [0, 1] | Place down the face: `(y − startY) / (endY − startY)` |
| `z` | [−0.4, 0.8] | Relief at that place, in units of the head's `radiusZ` |

Invariant: `v` is strictly increasing along the array.

The curve is a shape-preserving Hermite interpolation through the points. It is constant before the first and after
the last point. Across the face it falls off as a Gaussian of width `0.34·head.radiusX` about `head.centerX`.

#### 5.7.3 `hair`

An ellipsoid (§5.7.1), plus:

| Field | Rule | Meaning (depths in units of `hair.radiusZ`) |
|---|---|---|
| `frontGap` | [0, 0.6] | How far the front hair stands off the surface |
| `frontBulge` | [0, 1.5] | How much the front hair's depth follows the ellipsoid's curvature |
| `backDepth` | [0, 1] | How far back the rear hair lies |
| `crownRound` | [0, 1] | How much the crown is rounded as the head turns |
| `hairlinePin` | record | below |

`hairlinePin`: the region where hair is pinned to the scalp.

| Field | Rule | Meaning |
|---|---|---|
| `enabled` | boolean | |
| `mode` | `"rectangle"` or `"strand-roots"` | `rectangle` pins a feathered rectangle. `strand-roots` pins each hair layer above the line its strands' `rootY` trace (§5.3.4). |
| `centerX` | [−1.5, 1.5] | Rectangle centre, in head radii |
| `centerY` | [−1.5, 1.5] | |
| `halfWidth` | [0.01, 2] | Rectangle half-sizes, in head radii |
| `halfHeight` | [0.01, 2] | |
| `feather` | [0, 0.5] | Soft edge outside the rectangle, in head radii. 0.001 or less is a hard edge. |

#### 5.7.4 `torso`

The torso as a cylinder that the body turns on.

| Field | Required | Rule | Meaning |
|---|---|---|---|
| `enabled` | yes | boolean | |
| `blend` | yes | [0, 1] | How much of the cylinder's turn a point takes |
| `centerX` | yes | [0, W] | Cylinder axis, canvas pixels |
| `radiusX` | yes | [1, W] | Cylinder radii, canvas pixels |
| `radiusZ` | yes | [1, W] | |
| `yawFollowScale` | no | [0, 1] | How much of the automatic head-follow the torso turns by. Absent means 1. |
| `neckDepth` | no | [0, 1] | How far toward the front the neck stands, as a share of the depth there. Absent means 1 (on the front). |

### 5.8 `turnKeyforms` and `bodyTurnKeyforms`

Keyed turns: shapes drawn at the full turn, instead of computed ones.

- `turnKeyforms` keys the **head**. When it is absent, the head's turn is computed.
- `bodyTurnKeyforms` keys a figure's **body**. When it is absent, the torso turns as the cylinder of §5.7.4.

Both have the same layout. The value is a record (not an array) of at most 128 entries. Each key is a **family** name
of at most 64 characters, and each value is a **key**:

| Field | Required | Meaning |
|---|---|---|
| `plus` | yes | Lattice at the full turn toward +x (image right, `headYaw = +1`) |
| `minus` | yes | Lattice at the full turn toward −x |
| `up` | no | Lattice at the full nod raising the face (`headPitch = +1`). Head keys only. |
| `down` | no | Lattice at the full nod lowering it |

The nod lattices are used only when both `up` and `down` are present. Otherwise the nod is computed. The one exception
is a mouth, nose or brow key without both nod lattices, which takes the `face` key's nod lattices when the `face` key
has both.

**Lattice**:

| Field | Type | Rule | Meaning |
|---|---|---|---|
| `box` | [x0, y0, x1, y1] | 4 numbers, each with \|v\| ≤ 16384; `x1 > x0` and `y1 > y0` | The canvas bounds the lattice spans **in the turned drawing** |
| `grid` | number | integer in [2, 64] | Lattice points per side |
| `back` | number[] | exactly `grid · grid · 2` numbers, each with \|v\| ≤ 16384 | For each lattice point, the offset (dx, dy) back to where that point was at rest, in canvas pixels |
| `multiply` | [r, g, b] | optional; 3 numbers in [0, 16] | The part's colour at the full turn as a multiple of its colour at rest. The player clamps each channel to [0.5, 1.5]. |

Layout of `back`: lattice point (i, j), with i across and j down, both from 0 to `grid − 1`, lies in the turned
drawing at

```
X = x0 + (x1 − x0) · i / (grid − 1)
Y = y0 + (y1 − y0) · j / (grid − 1)
```

and its offset is `back[(j · grid + i) · 2]` (dx) and `back[(j · grid + i) · 2 + 1]` (dy). Points are stored row by
row from the top, each row left to right. The point at rest is (X + dx, Y + dy). Between points the offset is
bilinear, and outside the box it is held at the edge. The player inverts the lattice to find, for each rest vertex,
where it lies in the turned drawing.

A turn between rest and the full turn mixes the two linearly by the turn's share (−1…1). A combined turn and nod
composes the two keys. For the head, the full turn is `headYaw = ±1`, which for keyed heads the player takes as 0.52
radians (about 30°). For the body, the full turn is 20° of torso yaw.

**Head families** (`turnKeyformFamily` in `src/anime25drig/turnKeyforms.ts`, applied to resolved layers):

| Family | Layers |
|---|---|
| `neck`, `neckwear` | layers of that role, in either group |
| `back-hair`, `front-hair`, `headwear`, `ears`, `earwear` | head layers of that role |
| `front-hair:N` | a head layer named exactly `front-hair-N` (N digits). Falls back to `front-hair`. |
| `nose` | role `nose` |
| `brow:L`, `brow:R` | role `eyebrow` with that side. A brow without a side uses `face`. |
| `eye:L`, `eye:R` | a sided head layer whose role contains `eye`, `iris`, `irides` or `lovestruck-heart` |
| `iris:L`, `iris:R` | a sided head layer whose role contains `iris`, `irides` or `lovestruck-heart`. Falls back to `eye:<side>`. |
| `mouth` | a head layer whose role contains `mouth` or `drool`. Applied as a move and a stretch only, without shear. |
| `face` | every other head layer, and a mouth, nose or brow without a key of its own |

A key for `earwear` or `headwear` is ignored for a layer of which less than half the vertices lie inside its `plus` or
`minus` box.

**Body families** (`bodyTurnKeyFamily` in `src/anime25drig/bodyTurnKeyforms.ts`, body layers only):

| Family | Layers |
|---|---|
| `topwear` | role `topwear`, `collar-front`, `collar-back`, and `handwear` without a side |
| `arm:L`, `arm:R` | role `handwear` with that side. Blended into `topwear` at the shoulder seam. |
| `legwear:L`, `legwear:R`, `footwear:L`, `footwear:R` | sided legs and shoes. Fall back to `legwear` and `footwear`. |
| `thigh:L`, `thigh:R` | on a standing figure, bound for a sided `legwear` layer in preference to `legwear:<side>` |
| `neck`, `bottomwear`, `legwear`, `footwear` | layers of that role |

On a standing figure, only the families whose names start with `thigh`, `shin`, `legwear` or `footwear` are used.
Its trunk, sleeves, neck and head turn on the torso's cylinder. A standing figure's legs turn from their soles and do
not use their keys' offsets. Their keys' presence still matters, because it is what makes the head turn with the body.

Families with other names are valid and ignored.

### 5.9 `enhancement`

A record of what generated drawings the rig was enhanced with when imported. It is not read by the player.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `turn` | boolean | yes | Turn keys were fitted to generated turned drawings |
| `expressions` | boolean | yes | Expressions were redrawn by an image model |
| `body` | boolean | no | A standing figure's body turn keys were fitted to generated drawings |
| `arms` | boolean | no | Gesture arms were drawn by an image model |

### 5.10 `partProfile`

The parts that move on their own, such as an earring, a charm, a skirt or a ribbon, each as a rigger would give it a
bone and a swing.

| Field | Type | Rule |
|---|---|---|
| `version` | number | exactly `1` |
| `source` | string | `"ai-vision"` or `"none"` |
| `parts` | array | at most 64 parts |

**Part** (canvas pixels):

| Field | Type | Rule | Meaning |
|---|---|---|---|
| `name` | string | text(512) | |
| `layer` | string or `null` | `null` or text(512) | The name of the layer it is drawn in. `null` when none fits. |
| `separate` | boolean | | That layer is the part alone |
| `box` | [x0, y0, x1, y1] | 4 coordinates | The part's bounds. The validator does not check the order of the corners. |
| `anchor` | [x, y] | 2 coordinates | Where it is fixed and hangs from |
| `bone` | string | text(64) | The bone that carries it. The player recognises `head`, `hips`, `waist`, `thighL`, `thighR`, `shinL`, `shinR`, `footL` and `footR`. Any other name hangs from the chest. |
| `motion` | string | `"rigid"`, `"sway"`, `"dangle"` or `"flutter"` | How it moves |
| `material` | string | text(64) | What it is made of |
| `stiffness` | number | share | 0 limp … 1 stiff |
| `weight` | number | share | 0 very light … 1 heavy |

A part that is not `separate`, has `motion: "dangle"`, and is small relative to the canvas, is cut out of the layer it
shares and meshed as a piece of its own (`src/anime25drig/partSplit.ts`). Such pieces count toward the mesh limits
(§5.12).

### 5.11 `figureStance`

Optional. `"ground"` or `"float"`. When absent, `"ground"` applies. It is read only for a standing figure.

- `"ground"`: the figure stands on its soles.
- `"float"`: the figure floats. The upper body leads, and the legs hang and swing from the hips.

### 5.12 Package-wide limits

| Limit | Rule |
|---|---|
| Layers | 1 ≤ `layers.length` ≤ 128 (`contracts/merope_rig_contract.json`, `limits.maxParts`) |
| Atlas cuts | Σ over layers of `atlas.w · atlas.h` ≤ 4. The atlas may be cut out at most four times over. The import tool lays each layer in a place of its own, so its sum stays under 1. |
| Gesture-arm ground | Σ over layers of the bounding-box area of all points of `armVariant.model.ground`, where the area of one layer's rings is `(max x − min x + 1) · (max y − min y + 1)`. Must be ≤ 2 · 4096² = 33 554 432. |
| Mesh vertices per layer | ≤ 65 535 |
| Mesh vertices in total | ≤ 8 · 65 535 = 524 280 |

**Mesh limits.** The player meshes each layer as a grid. It uses 16-bit vertex indices, "the last of which means a new
strip". The rig contract's own vertex limits are for the manifest's parts, which are not drawn, and do not apply here.

The validator computes the most vertices each layer's mesh can come to (`layerMeshVertexBound` in
`src/anime25drig/layerGrid.ts`). For each hanging piece that may be cut out (§5.10), it takes the finest mesh among the
layers the piece may be cut from. It requires each mesh to be ≤ 65 535 vertices and the running total to be ≤
524 280. The comment on `playbackMeshesFit` says:

> The meshes the runtime would build, the hanging pieces it may cut out among them: each within what its indices
> reach (past that they wrap round), and all of them within memory.

A layer's grid depends on its resolved role and group, `fade`, `phys`, `w` and `h`, the face's width, the canvas
width, the shell's face profile, and whether the package is a standing figure. For example, head-surface layers are
meshed in cells of about 3% of the face's width, and eye layers more finely. A head layer much larger than the face is
therefore the usual way to exceed the limit.

A writer cannot easily precompute this bound without the reference mesher. A writer should keep layers within the
import tool's bounds: a document at most 4096 a side, and layers no larger than they need to be, especially head
layers relative to the face. It should then check the result with the reference validator (`isAnime25DPlayback`).

---

## 6. Pose corrections

Pose corrections are authored residuals added to the head and hair at combinations of pose axes, for example a turn
together with a closed eye. They live at `shellProfile.poseCorrections`.

### 6.1 Structure

`poseCorrections` is an array of at most 16 **corrections**. Each correction is a record:

| Field | Type | Rule |
|---|---|---|
| `surface` | string | `"head"`, `"front-hair"` or `"back-hair"` (§5.7) |
| `at` | record | 2 or 3 axis entries (§6.2) |
| `patches` | array | 1 to 8 patches |

**Patch** (all values finite):

| Field | Rule | Unit |
|---|---|---|
| `x` | [−2, 2] | Brush centre, head radii |
| `y` | [−2, 2] | |
| `radiusX` | [0.1, 2] | Brush radii, head radii |
| `radiusY` | [0.1, 2] | |
| `dx` | [−0.25, 0.25] | Displacement at the centre, head radii (× `head.radiusX`) |
| `dy` | [−0.25, 0.25] | Displacement at the centre, head radii (× `head.radiusY`) |

### 6.2 Rules for `at`

`at` maps axis keys (§6.3) to target values. The rules are:

- It has 2 or 3 entries.
- At least one entry is a head axis (`headYaw` or `headPitch`; in version 7 `angleX` or `angleY`).
- Every value is finite and in [−1, 1].
- A head axis value has |value| ≥ 0.05. It may be negative.
- Every other axis value is ≥ 0.05. It is positive.
- Every key is an axis key **of the package's version**. A key of the other version, or any other key, makes the
  package invalid.
- One correction per **corner**. A corner is the surface together with the sign of each axis present. Two corrections
  with the same surface, the same set of axes and the same signs are invalid, even if their values differ.

A correction of higher order must contain only the residual left after the lower-order corrections. It must not
contain a second absolute pose.

### 6.3 Axis keys by version

| Axis (version 8) | Version 7 key | Driver field it reads (§9.4) | Driver range |
|---|---|---|---|
| `headYaw` | `angleX` | `headYaw` | [−1, 1]; + turns the head toward image right |
| `headPitch` | `angleY` | `headPitch` | [−1, 1]; + raises the face |
| `lidCloseL` | `eyeCloseL` | `1 − lidL` | `lidL` in [0, 1]; 1 open as drawn, 0 shut |
| `lidCloseR` | `eyeCloseR` | `1 − lidR` | `lidR` in [0, 1] |
| `jaw` | `mouthOpen` | `jaw` | [0, 1]; 0 shut, 1 fully open |

The keys map one to one, in this order. The driver ranges are those `sanitizeDriverPatch` clamps to
(`src/anime25drig/driver.ts`).

### 6.4 Evaluation

**Weight.** For each correction and each frame:

```
weight = Π over the axes in `at` of  s(clamp(value / target, 0, 1))
s(t)   = t² · (3 − 2t)            (smoothstep)
```

Here `value` is the driver field of §6.3 and `target` is the axis's value in `at`. The weight is 1 at the corner and
beyond it, and 0 when any axis is at rest or on the other side.

**Brush.** For each vertex of each layer whose surface equals the correction's `surface`, the reference player:

1. normalises the vertex's **rest** position to head radii (§5.7.1), giving (x, y);
2. for each patch, computes `r = hypot((x − patch.x) / patch.radiusX, (y − patch.y) / patch.radiusY)`;
3. computes the kernel `k(r) = (1 − r)⁴ · (1 + 4r)` for r < 1, and 0 otherwise. This is a compact C² brush with zero
   value and zero slope at its edge;
4. sums over patches, overlaps included, the offset `(patch.dx · head.radiusX · k, patch.dy · head.radiusY · k)` in
   pixels.

Each frame the vertex moves by `weight × offset`. The offset is added **after the shell projection** (and after any
keyed turn) and **before the head's roll**. The shell's blend then mixes the whole corrected shell once.

Pose corrections apply only while `shellProfile.enabled` is true. They do not apply to rigid attachments: layers with
no `phys`, no fade other than `armVariant`, and role `neckwear`, `eyewear`, `earwear`, `headwear`, `wings`, `tail`,
`objects`, `arm-variant` or `unknown` (`isAnime25DRigidAttachment`).

---

## 7. Atlas image

- **Format.** A PNG image: 8-bit RGBA (colour type 6, bit depth 8), not interlaced, in the sRGB colour space (the
  import tool draws it on an sRGB canvas; no colour profile or gamma chunk is needed, and the player does not use one).
  It is the one image every layer's `atlas` rectangle cuts from (§5.3.3). The server stores only such PNGs, 256 to 8192
  pixels on each side. The reference player loads it through the browser's image decoder, so in practice it would draw
  any image the browser decodes, but the package format is the PNG above.
- **Orientation.** The image's first row is its top. Atlas `y` = 0 is the top edge and y grows downward. The player
  does not flip the image on upload.
- **Alpha.** The PNG holds straight (not premultiplied) alpha, as PNG defines. The player premultiplies on upload and
  draws premultiplied.
- **Pixel alignment.** When the player reads or patches a layer's own pixels, it rounds `atlas.x · width` and
  `atlas.y · height` to whole pixels. Writers should place cuts on whole pixels.
- **Gutters.** The player samples the atlas with mipmaps up to level 2. That assumes an 8-pixel transparent gutter
  between neighbouring cuts (`ANIME25D_ATLAS_MIP_GUTTER_PX`). Writers should leave at least 8 pixels between cuts.
- **Size.** The player enforces no atlas size limit of its own, beyond what the browser and GPU can load; the server
  stores atlases of 256 to 8192 pixels on each side (§1.1).

---

## 8. Rig manifest and rig contract

**Decision.** The rig manifest's field names (`schemaVersion`, `rigIrVersion`, `characterAssetContractVersion`,
`profile`, `sourceMasterAssetId`, `sourceGenerationFingerprint`, `quality`, `canvas`, `textures`, `bones`, `parts`,
`motionProfile`, `outfitProfile`, `semanticAnchors`, `semantics`, `spatialProfile`, `anime25dPlayback`) and the rig
contract `contracts/merope_rig_contract.json` are part of the persisted format. They are frozen as they are and owned
by the shared rig contract. Playback versions 7 and 8 do not change them. The contract file in this repository is a
byte-for-byte copy and is never edited here. They are persisted names because servers and other ports read stored
manifests by them, and because a stored package is named by a hash of its atlas and manifest bytes: renaming a field
would change every stored package's name. A change to them is a change to the shared rig contract (its
`schemaVersion`), not to the playback's version.

`MeropeRigManifest` (`src/rig/types.ts`) is the name of the TypeScript type in the reference code. It is not a
persisted name and appears in no document.

**What the player reads from a manifest.** The manifest is optional. The player reads it in only two places:

- **Chest weights.** When `chestProfile.enabled` is true and `chestProfile.source` is not `"ai-vision"`, the player
  looks for the bone whose `id` is `"a25d-chest"` in `bones`, and the part whose `id` is `"a25d-topwear"` in `parts`.
  Their `vertices` must form a full grid: every (x, y) combination of the vertices' distinct `position.x` and
  `position.y` values appears once. From them, the player takes each vertex's weight on that bone (the sum of
  `weights[k]` where `joints[k]` is the bone's index) as the chest weight field. If any of this is missing or not a
  full grid, the chest is weighted without it.
- **Capabilities.** The whole manifest is passed to the host's driver (`Anime25DDriving.measureCapabilities`). The
  basic driver ignores it.

The player does not read `anime25dPlayback`. The host passes the playback to the player separately, even when it is
stored inside the manifest.

For every other field of the manifest, and for the contract's profiles, capabilities, semantic roles, limits and
patterns, see `contracts/merope_rig_contract.json` and `src/rig/types.ts`. This document does not restate them. The
playback uses one value from the contract: `limits.maxParts` (128) bounds the number of layers (§5.12).

---

## 9. Pose JSON

A pose is one drawn frame of a figure as plain data: everything its drawing reads that changes from frame to frame.
Drawn again by a player of the same package, at any size, it gives the same picture. The reference reader and writer
are `poseToJSON` and `poseFromJSON` in `src/anime25drig/pose.ts`.

### 9.1 Versions

| `version` | Status |
|---|---|
| 1 | Read. Driver fields under their version 1 keys (§9.3). |
| 2 | **Written today** (`POSE_VERSION`). Driver fields under the driver's own names. |

`poseFromJSON` reads version 1 into version 2. For any other `version` value, including the string `"2"`, it throws a
`FigureError` with code `anime25dPoseVersion` and params `version` and `read` (`"1, 2"`). The English fallback message
is `This pose is of version {version}; this player reads versions {read}.` Text that is not JSON, or invalid base64,
throws an ordinary error.

### 9.2 Encoding

The pose is a JSON object. Three kinds of value are encoded as an object with exactly one key and a string value:

| Value | Encoded as |
|---|---|
| a `Float32Array` | `{"f32": "<base64>"}` |
| a `Uint16Array` | `{"u16": "<base64>"}` |
| −0, Infinity, −Infinity, NaN | `{"number": "-0"}`, `{"number": "Infinity"}`, `{"number": "-Infinity"}`, `{"number": "NaN"}` |

- The base64 is standard base64 with padding. It encodes the array's bytes as they lie in memory. Every platform the
  reference implementation runs on is little-endian, so readers must take the bytes as **little-endian** IEEE 754
  binary32 (`f32`) and little-endian unsigned 16-bit integers (`u16`).
- Every other number is a plain JSON number.
- The −0 and non-finite encoding applies to every number anywhere in the pose, inside plain arrays too: a `number[]`
  is a JSON array whose elements are plain numbers or `{"number": …}` objects (an arm's `sides` is often
  `[{"number": "-Infinity"}, 5.25]`). Typed arrays carry their own bits and need no such encoding.
- A reader decodes every object that has exactly one key, `f32`, `u16` or `number`, with a string value. It decodes
  such an object anywhere in the document. A `number` string is read as a JavaScript `Number(...)` conversion.

### 9.3 Version 1 driver keys

Version 1 keeps 16 driver fields and 6 switches under other keys. Every other field is under its own name in both
versions.

| Version 2 (driver field) | Version 1 key |
|---|---|
| `headYaw` | `angleX` |
| `headPitch` | `angleY` |
| `headRoll` | `angleZ` |
| `lidL` | `eyeOpenL` |
| `lidR` | `eyeOpenR` |
| `gazeX` | `eyeX` |
| `gazeY` | `eyeY` |
| `jaw` | `mouthOpen` |
| `lipCurve` | `mouthForm` |
| `browLift` | `brow` |
| `browTiltL` | `browAngL` |
| `browTiltR` | `browAngR` |
| `browTilt` | `browAngSym` |
| `bodyLean` | `body` |
| `torsoFollow` | `bodyYaw` |
| `rearHairSway` | `physAmp` |
| `torsoBreath` | `idle` |
| `physics` | `phys` |
| `idleSway` | `rand` |
| `autoBlink` | `blink` |
| `followPointer` | `mouse` |
| `talking` | `talk` |

Version 1 has no `hairWind` and no `breathing`: its `idle` switched the hair's wind as well as the torso's breath,
and the stage always breathed. Reading version 1 renames these keys inside `driver` only, keeping their order; then,
where the driver has no `hairWind`, sets it to the value read as `torsoBreath`, and where it has no `breathing`, sets
it to `true` (both added after the other fields). It sets `version` to 2. The rest of the document is the same in both
versions.

### 9.4 Fields (`Anime25DPose`)

| Field | Type | Meaning |
|---|---|---|
| `version` | number | 2 (or 1 on input) |
| `figure` | string | The package the pose was taken of (§9.5) |
| `time` | number | The stage's clock when the pose was taken |
| `driver` | record | Every driver field as it stood (below). This is the pose's meaning. It is not read to draw it. |
| `frame` | record | `viewWidth`, `viewHeight`, `bodyPivotX`, `bodyPivotY`, `bodyRotationCosine`, `bodyRotationSine`, `bodyBendHeight`, `time`, `eyeCry` (numbers), and optionally `bodyLift`: `centerX`, `upperY`, `lowerY`, `amount` and the optional `pitch`, `depth`, `shoulderY` |
| `order` | u16 | The drawn layers' indices in drawing order: a permutation of 0 … n−1 |
| `layers` | array | One per drawn layer (below) |
| `collar` | f32 or `null` | The collar clip's vertices, when the figure has one |
| `mouth` | record or `null` | The live mouth's shape: `wide`, `round`, `narrow` (the rest of the weight is the plain open mouth) |
| `sticker` | record or `null` | `time`, `amount`, `x`, `y`, `size` |
| `arms` | array | One per modelled arm side (below) |

**Layer pose**: `transform` (f32, 9 values, a 3×3 matrix in column order), `opacity` (number), `multiply` (f32 of 3, or
`null`), `behindFace` (number), `vertices` (f32 of x, y per vertex, or `null` for a layer whose vertices never move).

**Arm pose**: `side` (`"L"` or `"R"`), `now` and `leaving` (drawn arm or `null`), `cloths` (array, each `null` or
`{nodes: f32, under: u16, front: u16}`).

**Drawn arm**: `gesture` (string), `twist` (number or `null`), `cuff` (number), `radius` (number[]), `restEnd`
(number), `ink` (number or `null`), `joints` (`{s, e, w: number[3], hand: number[3][]}`), `presence`, `handRest`,
`hanging`, `restNear`, `unlined` (numbers), `foot` (at most 16 [x, y] pairs), `sides` (2 numbers), `held`
(`{pos: f32, near, exact: number, toDrawn: number[6] or null}` or `null`), `rest` (`{corners: number[8], alpha}` or
`null`), `also` (`null` or exactly 2 `{gesture, weight}`).

The layers, `order`, collar and arms are those of the player's prepared figure. That is not the package's `layers`
array one for one, because the player may split, drop or cut out layers. Their counts and lengths must match the
figure the pose is drawn on.

**Driver fields** (`Anime25DDriver`, `src/anime25drig/driver.ts`). In version 2, `driver` has these keys:

- Numbers: `headYaw`, `headPitch`, `headRoll`, `lidL`, `lidR`, `eyeDizzy`, `eyeSqueeze`, `eyeCry`, `anger`,
  `speechless`, `accentNotes`, `accentQuestion`, `accentSleep`, `accentSparkle`, `accentBlush`, `handWaveL`,
  `handPointL`, `handChestL`, `handChinL`, `handWaveR`, `handPointR`, `handChestR`, `handChinR`, `maniac`, `silly`,
  `lovestruck`, `gazeX`, `gazeY`, `browLift`, `jaw`, `mouthWide`, `mouthRound`, `mouthNarrow`, `mouthSeal`,
  `lipCurve`, `mouthCY`, `bodyLean`, `torsoFollow`, `torsoTurn`, `bodyLift`, `bodyPitch`, `rearHairSway`, `soft`,
  `browTiltL`, `browTiltR`, `browTilt`, `bangL`, `bangC`, `bangR`, `armY`, `armPos`, `armRaiseL`, `armRaiseR`,
  `armSwingL`, `armSwingR`, `bust`, `bustY`, `irisScale`, `eyeSmile`, `eyeWide`, `mouthEase`, `eyeEase`, `fhAmp`,
  `fhSoft`, `eyeCY`, `eyeCAng`, `mouthCAng`, `eyeScaleL`, `eyeScaleR`, `mouthScale`.
- Booleans: `breathing`, `torsoBreath`, `hairWind`, `physics`, `idleSway`, `autoBlink`, `followPointer`, `thinking`,
  `singing`, `talking`.

Their ranges are `DRIVER_LIMITS` in `src/anime25drig/driver.ts`.

### 9.5 Binding a pose to its package

`figure` is the figure key (`figureKey` in `src/anime25drig/poseFrame.ts`). It has the form `<n>-<hash>`:

- `n` is the number of layers in the player's prepared figure.
- `hash` is a 32-bit hash written in lower-case hexadecimal with no leading zeros (`Number.prototype.toString(16)`).
  It starts at `0x811C9DC5`; for each Unicode code point `c` of the text below, in order, it becomes
  `(hash XOR c) × 0x01000193 mod 2³²` (FNV-1a, with whole code points in place of bytes). The text is these parts
  joined with `|`:
  1. for each prepared layer, a canonical text of the layer as the package gives it, after role and group resolution
     and including its arm model: an object as `{key:value,…}` with its keys sorted by UTF-16 code units and members
     whose value is undefined left out, an array as `[a,b,…]`, a string, boolean or `null` as `JSON.stringify` writes
     it, and a number `v` as the decimal integer `Math.round(v · e · 100000)`, where `e` is Euler's number as a 64-bit
     float (`Math.E`, 2.718281828459045) and `Math.round` rounds halves up. A piece the player cut out of a layer is
     given by its name instead;
  2. for each modelled arm, `<side>:<its gestures joined by ",">`;
  3. `collar:<number of collar clip values>` and `mouth:<true|false>`.

The key does not depend on the package's version, its identity fields, or how the JSON was written out. The same layers
give the same key in version 7 and version 8. A pose is drawn only on a figure whose key equals `figure` and whose
counts and lengths all fit the pose. Otherwise it is refused: `renderPose` returns `false` and draws nothing.

The prepared layers depend on steps that read the atlas's pixels, such as splitting a paired ornament. A third party
therefore cannot always compute the key without the reference player. It should treat `figure` as an opaque string,
compare it for equality, and keep it unchanged.

---

## 10. Changes from version 7 to version 8

- [ ] `kind`: `"anime-2.5d-rig"` → `"myriad-figure"`.
- [ ] `version`: `7` → `8`.
- [ ] `engine`, `engineUrl`, `license`, `copyright` → removed. They are replaced by `credits[]` with `name`, `url`,
      `license`, `copyright` (§4.3). `credits` is required in version 8, 1 to 16 entries. Version 7 has room for one.
- [ ] Pose-correction axis keys in `shellProfile.poseCorrections[].at`: `angleX` → `headYaw`, `angleY` → `headPitch`,
      `eyeCloseL` → `lidCloseL`, `eyeCloseR` → `lidCloseR`, `mouthOpen` → `jaw`. The other version's keys are invalid.
- [ ] Everything else is unchanged: every other field, its place, its bounds, the sub-block versions, the atlas, the
      rig manifest and the contract.
- [ ] Writers keep emitting version 7 until every reader they reach reads version 8 (§3.1).

Separately from the package versions, pose JSON version 2 writes under their own names the 16 driver fields and 6
switches that version 1 keeps under other keys (§9.3).
