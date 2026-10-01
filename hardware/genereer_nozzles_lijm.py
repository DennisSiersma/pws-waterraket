#!/usr/bin/env python3
"""
Gardena-nozzle om op de originele dop te LIJMEN.

Opzet
-----
Geen geprinte schroefdraad, geen klikvingers: dit deel wordt met tweecomponenten-
lijm op een originele flesdop gezet waar een gat in geboord is. De dop zorgt voor
het haaks staan en voor de afdichting op de flesrand.

Het deel bestaat uit:
  - de Gardena-steel onderaan
  - een plaat die op de bovenkant van de dop ligt
  - een rok die om de dop heen valt: dat is het eigenlijke lijmvlak
  - drie lijmgroeven in de rok, zodat de lijm ergens in kan blijven staan
  - drie schroefgaten als mechanische achtervang

LET OP: LIJM HECHT SLECHT OP DOPPEN
Flesdoppen zijn van HDPE of PP. Die hebben een lage oppervlakte-energie en
gewone epoxy pakt daar nauwelijks op aan. Opties, van sterk naar zwak:

  1. Lijm die voor polyolefinen gemaakt is: 3M DP8010 (structureel, tweecomponent)
     of secondelijm met Loctite 770 primer.
  2. Gewone epoxy, maar dan eerst schuren EN vlammen (kort met een aansteker over
     het oppervlak) en direct lijmen.
  3. Gewone epoxy op een onbehandelde dop: dit laat los.

De drie schroefgaten zijn de achtervang: zet er na het lijmen drie korte
zelftappers (2,2 mm) doorheen, de rok in en de dopwand in. Dan houdt het ook als
de lijmverbinding tegenvalt. Zonder die schroeven zou de hele belasting op een
verbinding staan die op dit materiaal onbetrouwbaar is.

Rekensom: bij 7 bar en een afdichting op 16 mm drukt er circa 14 kg aan kracht
tegen het deel. Het lijmvlak is ongeveer 1100 mm2, dus de lijm hoeft maar 0,13
N/mm2 te houden. Dat is weinig, maar op onbehandeld PP haal je dat niet.

MONTAGE
  1. Boor 10,0 mm midden in een originele dop.
  2. Schuur de buitenkant van de dop ruw en ontvet hem.
  3. O-ring 16 x 2 mm in de groef van het nozzledeel.
  4. Lijm aanbrengen in de rok en op de dopwand, nozzle eroverheen drukken.
  5. Uit laten harden (bij epoxy: 24 uur, niet de snelle variant van 5 minuten).
  6. Drie zelftappers door de schroefgaten.
  7. Pas daarna op de fles draaien.

NAMETEN: `DOP_D` (buitendiameter van de dop, staat op 30,0) en `DOP_H`
(hoogte van de dop, staat op 11,5). Zit de rok te ruim, dan vult de lijm dat op,
maar te krap gaat hij er niet overheen.

Printen: Gardena-kant op het bed, geen supports, PETG.

Draaien:  ../../.venv/bin/python genereer_nozzles_lijm.py
"""
import numpy as np
import trimesh

# ---------------- Gardena-steel (opgemeten uit Raketfued Nozzle_8mm.stl) ------
STEEL = [
    (0.0, 15.1), (0.6, 15.5), (2.6, 15.5),
    (3.0, 11.8), (3.4, 11.4), (5.4, 11.4), (5.8, 11.8),   # O-ringgroef
    (6.2, 15.5), (7.8, 15.6),
    (8.2, 17.0), (10.6, 17.0),                            # greepkraag
    (11.0, 15.7), (11.4, 14.0), (11.8, 13.5), (15.4, 13.5),
    (16.2, 13.7), (17.0, 14.0), (17.8, 14.7), (18.6, 15.9),
    (19.4, 17.7), (20.2, 20.3), (22.6, 20.3),
]

# ---------------- dopmaten (NAMETEN) ----------------
DOP_D     = 29.0     # buitendiameter van de dop, gemeten
DOP_H     = 9.15     # hoogte van de dop, gemeten
DOP_SPEL  = 0.4      # speling van de rok over de dop; de lijm vult dit
DOPGAT_D  = 10.0     # gat dat je in de dop boort

# ---------------- nozzledeel ----------------
PLAAT     = 4.0
ROK_WAND  = 2.8
ROK_DIEP  = 8.6      # iets korter dan de dop, zodat de rok niet voorbij de doprand steekt
GROEF_N   = 3        # lijmgroeven in de rok
GROEF_D   = 0.8
SCHROEF_D = 2.2
SCHROEF_N = 3
ORING_D   = 2.0
INTREDE_R = 2.5
SEG       = 96

MATEN = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def ring(r_bu, r_bi, h, z):
    bu = trimesh.creation.cylinder(radius=r_bu, height=h, sections=SEG)
    bi = trimesh.creation.cylinder(radius=r_bi, height=h + 2, sections=SEG)
    bu.apply_translation((0, 0, z)); bi.apply_translation((0, 0, z))
    return trimesh.boolean.difference([bu, bi], engine='manifold')


def bouw(d_gat):
    r_rok_bi = DOP_D / 2 + DOP_SPEL / 2
    r_rok_bu = r_rok_bi + ROK_WAND

    z_st = STEEL[-1][0]
    z_dop = z_st + PLAAT                 # bovenkant van de dop
    z_top = z_dop + ROK_DIEP             # onderrand van de rok

    prof = [(d / 2, z) for z, d in STEEL]
    prof += [
        (r_rok_bu - 1.2, z_st + 0.6),
        (r_rok_bu, z_st + 1.8),
        (r_rok_bu, z_top),
        (r_rok_bi, z_top),
        (r_rok_bi, z_dop),
        (DOPGAT_D / 2 + 3.0, z_dop),
    ]
    n = omw(prof)

    # doorlaat met afgeronde intrede
    r = d_gat / 2
    p = []
    for i in range(21):
        hoek = (i / 20) * np.pi / 2
        p.append((r + INTREDE_R * np.cos(hoek),
                  z_dop + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, -1.0)] + p[::-1] + [(r + INTREDE_R, z_dop + 1.0)]

    # O-ringgroef in het plaatvlak
    r_mid = DOPGAT_D / 2 + 3.0
    gh = ORING_D * 0.55
    groef = ring(r_mid + ORING_D / 2, r_mid - ORING_D / 2, gh, z_dop - gh / 2)

    n = trimesh.boolean.difference([n, omw(kanaal), groef], engine='manifold')

    # lijmgroeven: ringen aan de BINNENkant van de rok, zodat de lijm blijft staan
    weg = []
    for i in range(GROEF_N):
        z = z_dop + 1.8 + i * 2.4
        weg.append(ring(r_rok_bi + GROEF_D, r_rok_bi - 0.1, 1.2, z))
    # schroefgaten ALLEEN door de rokwand: een doorlopend gat zou binnenin de
    # dop tegen de fleshals komen
    for i in range(SCHROEF_N):
        a = 2 * np.pi * i / SCHROEF_N
        g = trimesh.creation.cylinder(radius=SCHROEF_D / 2, height=ROK_WAND + 4,
                                      sections=24)
        g.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
        g.apply_translation((r_rok_bi + ROK_WAND / 2, 0, z_dop + ROK_DIEP - 3.0))
        g.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        weg.append(g)
    n = trimesh.boolean.difference([n] + weg, engine='manifold')

    n.merge_vertices(); n.update_faces(n.nondegenerate_faces())
    n.update_faces(n.unique_faces()); n.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(n)

    naam = 'PWS_Waterraket_NozzleLijm_%02dmm.stl' % round(d_gat)
    n.export(naam)
    t = trimesh.load(naam)
    e = t.bounding_box.extents
    lijmvlak = np.pi * DOP_D * ROK_DIEP
    print("%-40s gat %4.1f   %.1f x %.1f x %.1f mm   lijmvlak %.0f mm2   waterdicht: %s"
          % (naam, d_gat, e[0], e[1], e[2], lijmvlak, t.is_watertight))
    return t


print("rok valt %.1f mm over een dop van %.1f mm; %d lijmgroeven, %d schroefgaten\n"
      % (ROK_DIEP, DOP_D, GROEF_N, SCHROEF_N))
for d in MATEN:
    bouw(d)
