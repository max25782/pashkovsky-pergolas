# @pashkovsky/pergola-3d-preview

R3F viewer for `CutPiece[]` from `@pashkovsky/pergola-core`.

## Materials

One geometry path. Finish is chosen from `spec.colorHex`:

- `#RRGGBB` or `RAL####` → aluminium PBR (`metalness` 0.9, `roughness` 0.35)
- `wood` / `wood:oak` / `wood:teak` / `wood:walnut` → wood PBR (dielectric)

RAL → hex lives in `src/ral.ts` (data table, not component constants).

**Texture maps are not bundled.** AluFlow files were not copied. Numeric PBR
parameters only. If maps are added later, use CC0 sets such as:

- [ambientCG](https://ambientcg.com) Metal 038 / Wood 047 (CC0 1.0)
- [Poly Haven](https://polyhaven.com) metal/wood textures (CC0)

License of those sources: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Scene

`SceneBackdrop` owns IBL (`drei` `<Environment>` built-in presets `city` /
`park`), one sun with shadows, `ContactShadows`, and the ground. The grey
grid is gone. Tone mapping is ACES Filmic, output colour space sRGB.
Height comes from `spec.heightMm` via the pieces the host already computed.
