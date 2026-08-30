#!/usr/bin/env python3
"""
Nozzles voor de waterraket - als insteek in een GEBOORDE ORIGINELE FLESDOP.

Waarom zo? Een geprinte schroefdraad richt zich uit op de vier losse
draadsegmenten van de PCO1881-hals. Die zijn gemaakt om een dop aan te trekken,
niet om iets haaks te positioneren, en een geprinte draad loopt door laaglijnen
ergens vroeg aan. Daardoor staat de nozzle scheef.

Een originele dop is spuitgegoten en zit altijd haaks op de flesmond. Wij printen
daarom alleen het gekalibreerde gaatje, niet de draad.

Opbouw van onder (buiten de fles) naar boven (in de fles):
  rokje       blijft buiten tegen de dop, geeft een nette afsluiting
  steel       door het geboorde gat van 16 mm
  flens       binnen in de dop; de druk duwt hem hiertegenaan (zelfdichtend)
  geleiding   15 mm in de flesmond: dit dwingt de nozzle recht
  doorlaat    met afgeronde intrede, zodat de stroming reproduceerbaar is

MONTAGE
  1. Boor 16,0 mm midden in een originele dop. Klem de dop vast, boor langzaam,
     en werk de rand na met een mesje.
  2. Duw de nozzle er VAN BINNENUIT in: de flens hoort aan de binnenkant van de
     dop te zitten, dus aan de kant van het water.
  3. Dicht af met een dun laagje siliconenkit op de flens, of met PTFE-tape om
     de steel. De druk drukt de flens vanzelf tegen de dop aan.
  4. Dop op de fles draaien.

CONTROLE OP HAAKSHEID
  Zet de fles met dop op een vlakke tafel, op zijn kop. Draai de fles rond en
  kijk of de nozzle op zijn plek blijft. Wiebelt hij, dan zit er speling in het
  geboorde gat: maak dan een nieuwe dop, of vul de speling met wat kit.

Draaien:  ../../.venv/bin/python genereer_nozzles.py
Printen:  staand, rokje op het bed, 0,2 mm laagjes, geen supports.
          Zet 'olifantenpoot-compensatie' aan, anders wordt de onderrand breder.
"""
import numpy as np
import trimesh

# ---------------- vaste maten (mm) ----------------
HALS_D      = 21.74   # binnendiameter PCO1881-flesmond
HALS_SPEL   = 0.5     # speling van de geleiding in de hals
DOPGAT_D    = 16.0    # gat dat je in de dop boort
GAT_SPEL    = 0.3     # speling van de steel in dat gat
DOP_T       = 2.0     # dikte van de bovenkant van de dop  -- METEN
ROKJE_D     = 19.0
ROKJE_H     = 2.0
FLENS_D     = 20.0
FLENS_H     = 3.0
GELEIDING_H = 15.0    # hoe ver de nozzle in de hals steekt: dit richt hem
INTREDE_R   = 3.0     # afronding van de intrede
SEG         = 72

# de te printen maten
MATEN = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]


def omw(punten):
    """Gesloten omwentelingslichaam uit (r, z)-punten."""
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=SEG)


def bouw(d_gat):
    steel_d = DOPGAT_D - GAT_SPEL
    geleiding_d = HALS_D - HALS_SPEL

    z0 = 0.0
    z1 = z0 + ROKJE_H
    z2 = z1 + DOP_T + 0.4
    z3 = z2 + 2.0                     # 45 graden schuin: printbaar zonder support
    z4 = z3 + FLENS_H
    z5 = z4 + GELEIDING_H

    body = omw([
        (ROKJE_D / 2, z0), (ROKJE_D / 2, z1),
        (steel_d / 2, z1), (steel_d / 2, z2),
        (FLENS_D / 2, z3), (FLENS_D / 2, z4),
        (geleiding_d / 2, z4), (geleiding_d / 2, z5),
    ])

    # doorlaat met afgeronde intrede bovenin
    r = d_gat / 2
    prof = []
    m = 24
    for i in range(m + 1):
        hoek = (i / m) * np.pi / 2
        prof.append((r + INTREDE_R * np.cos(hoek),
                     z5 + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, z0 - 1.0)] + prof[::-1] + [(r + INTREDE_R, z5 + 1.0)]

    n = trimesh.boolean.difference([body, omw(kanaal)], engine='manifold')

    # opruimen: STL bewaart 32-bits floats, kleine driehoekjes vallen anders samen
    n.merge_vertices()
    n.update_faces(n.nondegenerate_faces())
    n.update_faces(n.unique_faces())
    n.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(n)

    naam = 'PWS_Waterraket_Nozzle_%02dmm.stl' % round(d_gat)
    n.export(naam)

    terug = trimesh.load(naam)          # controle op wat de slicer straks inleest
    e = terug.bounding_box.extents
    print("%-34s gat %4.1f mm   %.1f x %.1f x %.1f mm   waterdicht: %s"
          % (naam, d_gat, e[0], e[1], e[2], terug.is_watertight))
    return terug


print("boor %.1f mm in de dop  |  steel %.1f mm  |  geleiding %.1f mm in de hals\n"
      % (DOPGAT_D, DOPGAT_D - GAT_SPEL, HALS_D - HALS_SPEL))
for d in MATEN:
    bouw(d)
