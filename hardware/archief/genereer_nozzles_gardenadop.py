#!/usr/bin/env python3
"""
Gardena-nozzle IN EEN GEBOORDE ORIGINELE FLESDOP.

Waarom deze route
-----------------
Twee eerdere pogingen faalden, allebei door dezelfde oorzaak: de schroefdraad
werd MEEGEPRINT.

  1. Raketfued-nozzle: de dop raakt de flesrand niet en hangt volledig aan de
     geprinte draad. De vier losse draadsegmenten van een PCO1881-hals zijn
     gemaakt om aan te trekken, niet om iets haaks te positioneren.
  2. Onze versie met geleidingsbossing: die bossing en de binnendraad vragen
     support, en dat support zit op een plek waar je niet bij kunt. Restanten
     daarvan trekken de dop opnieuw scheef.

Hier printen we de draad DUS NIET. Een originele dop is spuitgegoten en zit
altijd haaks op de flesmond, en dicht bovendien al af met zijn eigen liner.
Wij printen alleen de Gardena-steel met de gekalibreerde doorlaat.

Belangrijk: dit ontwerp heeft NERGENS een overhang die support nodig heeft.
Alles is een omwentelingslichaam met hoogstens 45 graden.

Hoe het vastzit
---------------
De flens zit BINNEN in de dop, aan de waterkant. De druk in de fles duwt de
nozzle naar buiten en drukt de flens daarmee tegen de binnenkant van de dop:
hoe hoger de druk, hoe beter de afdichting. Trekken aan het Gardena-koord kan
hem er dus niet uittrekken.

MONTAGE
  1. Boor 16,0 mm midden in een originele dop. Klem de dop vast, boor langzaam,
     werk de rand na met een mesje.
  2. Duw de nozzle er VAN BINNENUIT in: eerst de Gardena-steel door het gat,
     de flens blijft binnen.
  3. Dun laagje siliconenkit rond de flens, of PTFE-tape om de steel.
  4. Laten uitharden, dan de dop op de fles draaien.

CONTROLE
  Fles op zijn kop op een vlakke tafel, ronddraaien: de nozzle hoort op zijn
  plek te blijven. Vergelijk dit met de oude nozzles en noteer het verschil.

Draaien:  ../../.venv/bin/python genereer_nozzles_gardenadop.py
Printen:  Gardena-kant op het bed, 0,15 mm, GEEN supports, PETG.
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

# ---------------- dop en pasmaten (mm) ----------------
DOPGAT_D  = 16.0    # gat dat je in de dop boort
GAT_SPEL  = 0.3     # speling van de steel in dat gat
DOP_T     = 2.2     # dikte van de bovenkant van de dop   -- METEN
DOP_BINNEN_D = 25.0 # vrije binnendiameter van de dop     -- METEN
KRAAG_D   = 19.0    # rustvlak tegen de buitenkant van de dop
KRAAG_H   = 2.0
FLENS_H   = 3.0
INTREDE_R = 3.0
SEG       = 96

MATEN = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def bouw(d_gat):
    steel_d = DOPGAT_D - GAT_SPEL              # past in het geboorde gat
    flens_d = min(DOP_BINNEN_D - 1.0, 24.0)    # centreert in de dop

    z_st = STEEL[-1][0]                        # bovenkant Gardena-steel
    z_kr = z_st + KRAAG_H                      # kraag tegen de buitenkant dop
    z_dp = z_kr + DOP_T + 0.3                  # steel door de dopwand
    z_fl0 = z_dp + (flens_d - steel_d) / 2     # 45 graden schuin omhoog
    z_fl1 = z_fl0 + FLENS_H                    # flens binnen in de dop

    prof = [(d / 2, z) for z, d in STEEL]
    prof += [
        (KRAAG_D / 2, z_st + 0.4),             # schuine overgang naar de kraag
        (KRAAG_D / 2, z_kr),
        (steel_d / 2, z_kr),
        (steel_d / 2, z_dp),
        (flens_d / 2, z_fl0),                  # 45 graden: printbaar zonder support
        (flens_d / 2, z_fl1),
    ]
    body = omw(prof)

    # doorlaat over de hele lengte, met afgeronde intrede aan de waterkant
    r = d_gat / 2
    p = []
    m_ = 20
    for i in range(m_ + 1):
        hoek = (i / m_) * np.pi / 2
        p.append((r + INTREDE_R * np.cos(hoek),
                  z_fl1 + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, -1.0)] + p[::-1] + [(r + INTREDE_R, z_fl1 + 1.0)]

    n = trimesh.boolean.difference([body, omw(kanaal)], engine='manifold')
    n.merge_vertices()
    n.update_faces(n.nondegenerate_faces())
    n.update_faces(n.unique_faces())
    n.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(n)

    naam = 'PWS_Waterraket_NozzleGardenaDop_%02dmm.stl' % round(d_gat)
    n.export(naam)
    t = trimesh.load(naam)
    e = t.bounding_box.extents
    print("%-44s gat %4.1f   %.1f x %.1f x %.1f mm   waterdicht: %s"
          % (naam, d_gat, e[0], e[1], e[2], t.is_watertight))
    return t


print("boor %.1f mm in de dop  |  steel %.1f mm  |  flens %.1f mm binnenin\n"
      % (DOPGAT_D, DOPGAT_D - GAT_SPEL, min(DOP_BINNEN_D - 1.0, 24.0)))
for d in MATEN:
    bouw(d)
