#!/usr/bin/env python3
"""
Gardena-nozzle als OPZETSTUK over de originele flesdop.

Het idee
--------
Alle eerdere pogingen gingen mis omdat er geprinte schroefdraad in zat. Hier zit
die er niet meer in, in geen enkele vorm:

  1. Je draait een ORIGINELE dop op de fles. Die is spuitgegoten, staat per
     definitie haaks en dicht af met zijn eigen liner.
  2. In die dop boor je een gat.
  3. Dit geprinte opzetstuk valt OVER de dop heen en haakt met vier vingers
     onder de steunring van de fles. Daarmee kan de druk het er niet afduwen.
  4. Onderaan zit de Gardena-steel voor de launcher.

Uitlijning komt van de steunring (33,07 mm, spuitgegoten en rond) en van de
dop zelf. Nergens zit meer een geprinte draad die de stand bepaalt.

Afdichting
----------
Twee keer: de originele dop dicht af op de flesrand (zijn eigen liner), en een
O-ring tussen het opzetstuk en de bovenkant van de dop vangt af wat er door het
geboorde gat komt. De druk duwt het opzetstuk tegen de vingers, en die trekken
de O-ring juist aan.

MONTAGE
  1. Boor 10,0 mm midden in een originele dop (dop vastklemmen, langzaam boren,
     rand nawerken met een mesje).
  2. O-ring 16 x 2 mm in de groef van het opzetstuk.
  3. Dop op de fles draaien.
  4. Opzetstuk eroverheen drukken tot de vingers onder de steunring klikken.
  5. Tiewrap in de groef rond de vingers: die kunnen dan niet meer openwijken.

TWEE MATEN NAMETEN (staan bovenin als DOP_HOOGTE en RING_DIK)
  - hoogte van de dop: van de bovenkant van de dop tot de bovenkant van de
    steunring; staat op 16,0 mm
  - dikte van de steunring zelf; staat op 1,8 mm
Kloppen die niet, dan klikt hij niet of zit hij los.

Printen: Gardena-kant op het bed, geen supports, PETG, 0,2 mm laagjes.

Draaien:  ../../.venv/bin/python genereer_nozzles_opzetstuk.py
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

# ---------------- maten van fles en dop (mm) ----------------
RING_D     = 33.07   # buitendiameter steunring, gemeten
RING_DIK   = 1.8     # dikte van de steunring            -- NAMETEN
DOP_HOOGTE = 16.0    # bovenkant dop tot bovenkant ring  -- NAMETEN
DOP_D      = 30.0    # buitendiameter van de dop         -- NAMETEN (ruim genomen)
DOPGAT_D   = 10.0    # gat dat je in de dop boort

# ---------------- opzetstuk ----------------
PLAAT      = 4.0     # dikte van de plaat op de dop
ROK_WAND   = 2.6
ROK_SPEL   = 0.6     # speling van de rok over de steunring
LIP        = 1.1     # hoeveel de vingers onder de ring grijpen
LIP_H      = 2.2
VINGER_N   = 4
SLEUF_B    = 4.5     # breedte van de sleuven tussen de vingers
TIE_H, TIE_D = 4.0, 1.2
ORING_D    = 2.0     # O-ringkoord; 16 x 2 mm past in de groef
INTREDE_R  = 2.5
SEG        = 96

MATEN = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def bouw(d_gat):
    r_rok_bi = RING_D / 2 + ROK_SPEL / 2          # valt over de steunring
    r_rok_bu = r_rok_bi + ROK_WAND
    r_lip = r_rok_bi - LIP                        # grijpt onder de ring

    z_st = STEEL[-1][0]                 # bovenkant Gardena-steel
    z_dop = z_st + PLAAT                # hier ligt de bovenkant van de dop
    z_ring = z_dop + DOP_HOOGTE         # bovenkant van de steunring
    z_lip = z_ring + RING_DIK           # daarboven grijpt de lip naar binnen
    z_top = z_lip + LIP_H

    # buitenvorm: Gardena-steel, plaat, rok, en bovenaan de grijplip
    prof = [(d / 2, z) for z, d in STEEL]
    prof += [
        (r_rok_bu - 1.2, z_st + 0.6),   # schuine overgang naar de rok
        (r_rok_bu, z_st + 1.8),
        (r_rok_bu, z_top),
        (r_lip, z_top),                 # lip naar binnen
        (r_lip, z_lip),
        (r_rok_bi, z_lip - 0.8),        # schuine aanloop: klikt makkelijk
        (r_rok_bi, z_dop),              # binnenkant van de rok
        (DOPGAT_D / 2 + 3.0, z_dop),    # plaatvlak dat op de dop rust
    ]
    body = omw(prof)

    # doorlaat met afgeronde intrede aan de dopkant
    r = d_gat / 2
    p = []
    for i in range(21):
        hoek = (i / 20) * np.pi / 2
        p.append((r + INTREDE_R * np.cos(hoek),
                  z_dop + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, -1.0)] + p[::-1] + [(r + INTREDE_R, z_dop + 1.0)]

    # O-ringgroef in het plaatvlak, rond het geboorde gat
    r_mid = DOPGAT_D / 2 + 3.0
    gh = ORING_D * 0.55
    bu = trimesh.creation.cylinder(radius=r_mid + ORING_D / 2, height=gh, sections=SEG)
    bi = trimesh.creation.cylinder(radius=r_mid - ORING_D / 2, height=gh + 2, sections=SEG)
    bu.apply_translation((0, 0, z_dop - gh / 2))
    bi.apply_translation((0, 0, z_dop - gh / 2))
    groef = trimesh.boolean.difference([bu, bi], engine='manifold')

    n = trimesh.boolean.difference([body, omw(kanaal), groef], engine='manifold')

    # tiewrap-groef rond de vingers, zodat ze niet kunnen openwijken
    tz = z_ring - TIE_H - 1.0
    bu2 = trimesh.creation.cylinder(radius=r_rok_bu + 1, height=TIE_H, sections=SEG)
    bi2 = trimesh.creation.cylinder(radius=r_rok_bu - TIE_D, height=TIE_H + 2, sections=SEG)
    bu2.apply_translation((0, 0, tz)); bi2.apply_translation((0, 0, tz))
    n = trimesh.boolean.difference(
        [n, trimesh.boolean.difference([bu2, bi2], engine='manifold')], engine='manifold')

    # sleuven: maken de vier vingers die over de ring klikken
    sleuven = []
    for i in range(VINGER_N):
        a = 2 * np.pi * i / VINGER_N + np.pi / 4
        sl = trimesh.creation.box(extents=(r_rok_bu * 2 + 4, SLEUF_B, z_top - z_dop + 8))
        sl.apply_translation((0, 0, (z_top + z_dop) / 2 + 2))
        sl.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        sleuven.append(sl)
    n = trimesh.boolean.difference([n] + sleuven, engine='manifold')

    n.merge_vertices(); n.update_faces(n.nondegenerate_faces())
    n.update_faces(n.unique_faces()); n.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(n)

    naam = 'PWS_Waterraket_NozzleOpzet_%02dmm.stl' % round(d_gat)
    n.export(naam)
    t = trimesh.load(naam)
    e = t.bounding_box.extents
    print("%-42s gat %4.1f   %.1f x %.1f x %.1f mm   waterdicht: %s"
          % (naam, d_gat, e[0], e[1], e[2], t.is_watertight))
    return t


print("rok valt over de steunring (%.2f mm); %d vingers grijpen %.1f mm eronder\n"
      % (RING_D, VINGER_N, LIP))
for d in MATEN:
    bouw(d)
