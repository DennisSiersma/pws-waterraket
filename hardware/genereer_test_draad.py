#!/usr/bin/env python3
"""
PROEFSTUKKEN voor de schroefdraad van de neus, zodat je niet steeds een hele
romp hoeft te printen.

  PWS_Waterraket_Test_Draadring.stl       ring van 18 mm met de BINNENdraad
                                          van de romp (identieke maten)
  PWS_Waterraket_Test_Neusstomp_07.stl    neusdraad met 0,7 mm speling (huidig)
  PWS_Waterraket_Test_Neusstomp_09.stl    neusdraad met 0,9 mm speling
  PWS_Waterraket_Test_Neusstomp_11.stl    neusdraad met 1,1 mm speling

Print de ring een keer (staand, zoals de romp) en de drie stompjes (staand,
zoals de neuzen). Probeer ze een voor een. De eerste die soepel draait en niet
rammelt, is jouw speling. Zet die waarde dan in genereer_neuzen.py bij NEUS_SPEL
en genereer de echte neuzen opnieuw; de romp hoeft NIET opnieuw.

Waarom dit zo lastig is: PETG krimpt 0,3 tot 0,5% (op 89 mm een halve
millimeter), de laagnaad is een bultje, en de onderste laag wordt platgedrukt.
Dat verschilt per printer en per filament, dus het is niet uit te rekenen.
Daarom meten in plaats van gokken. Samen ~25 g filament.

Draaien:  ../../.venv/bin/python genereer_test_draad.py
"""
import numpy as np
import trimesh

# --- identiek aan genereer_recovery.py / genereer_neuzen.py ---
FLES_D, FLES_SPEL, WAND = 88.5, 1.0, 1.6
NEUS_SPOED, NEUS_GANGEN, NEUS_SLAG, NEUS_DIEPTE = 5.0, 3, 12.0, 2.2
ID = FLES_D + FLES_SPEL
OD = ID + 2 * WAND
R_IN = ID / 2
SEG = 96


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]] + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def pijp(d_out, d_in, h, z0):
    a = trimesh.creation.cylinder(radius=d_out / 2, height=h, sections=SEG)
    a.apply_translation((0, 0, z0 + h / 2))
    b = trimesh.creation.cylinder(radius=d_in / 2, height=h + 2, sections=SEG)
    b.apply_translation((0, 0, z0 + h / 2))
    return trimesh.boolean.difference([a, b], engine='manifold')


def draadgang(r_basis, r_top, hoogte, z0, spoed, gangen, buiten):
    """Zelfde opbouw als in de echte scripts: profiel langs een schroeflijn."""
    kruin, flank = spoed * 0.14, spoed * 0.26
    basis = r_basis - 0.4 if buiten else r_basis + 0.4
    prof = [(basis, -(kruin + flank)), (r_top, -kruin),
            (r_top, kruin), (basis, kruin + flank)]
    n_ = len(prof)
    stukken = []
    for g in range(gangen):
        start = 2 * np.pi * g / gangen
        omwn = hoogte / (spoed * gangen)
        stappen = max(int(omwn * 160), 40)
        t = np.linspace(0.0, omwn * 2 * np.pi, stappen)
        V, F = [], []
        for hoek in t:
            c, sn = np.cos(hoek + start), np.sin(hoek + start)
            zc = z0 + hoek / (2 * np.pi) * spoed * gangen
            for (pr, pz) in prof:
                V.append((pr * c, pr * sn, zc + pz))
        for i in range(stappen - 1):
            for k in range(n_):
                a_ = i * n_ + k; b_ = i * n_ + (k + 1) % n_
                c_ = (i + 1) * n_ + (k + 1) % n_; d_ = (i + 1) * n_ + k
                F.append((a_, b_, c_)); F.append((a_, c_, d_))
        for (idx, keer) in ((0, False), (stappen - 1, True)):
            bs = idx * n_
            for k in range(1, n_ - 1):
                tri = (bs, bs + k, bs + k + 1)
                F.append(tri[::-1] if keer else tri)
        m_ = trimesh.Trimesh(vertices=np.array(V), faces=np.array(F), process=True)
        trimesh.repair.fix_normals(m_)
        stukken.append(m_)
    return stukken


def schoon(m, naam):
    m.merge_vertices(); m.update_faces(m.nondegenerate_faces())
    m.update_faces(m.unique_faces()); m.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(m); trimesh.repair.fix_normals(m)
    m.export(naam)
    t = trimesh.load(naam)
    e = t.bounding_box.extents
    print("%-42s %.1f x %.1f x %.1f mm  %.1f cm3  waterdicht %s  delen %d"
          % (naam, e[0], e[1], e[2], t.volume / 1000, t.is_watertight, t.body_count))


# ---------- draadring: bovenste 18 mm van de romp ----------
H = 18.0
ring = pijp(OD, ID, H, 0)
ring = trimesh.boolean.union([ring] + draadgang(R_IN, R_IN - NEUS_DIEPTE, NEUS_SLAG, 2.0,
                                               NEUS_SPOED, NEUS_GANGEN, buiten=False),
                             engine='manifold')
aanloop = omw([(R_IN + 0.9, H - 1.5), (R_IN + 0.9, H + 1)])      # zelfde aanloopschuinte
ring = trimesh.boolean.difference([ring, aanloop], engine='manifold')
schoon(ring, 'PWS_Waterraket_Test_Draadring.stl')

# ---------- neusstompjes: draad + kraag + 6 mm stomp, drie spelingen ----------
for spel in (0.7, 0.9, 1.1):
    r_kern = R_IN - NEUS_DIEPTE - spel      # kern ONDER de rompruggen, niet erboven
    r_kruin = R_IN - spel
    z_dr, z_kraag0, z_top = 1.0, 14.0, 17.0
    body = omw([(r_kern, 0.0), (r_kern, z_kraag0), (OD / 2, z_kraag0),
                (OD / 2, z_top), (OD / 2 - 4.0, z_top), (OD / 2 - 4.0, z_top + 6.0)])
    stomp = trimesh.boolean.union([body] + draadgang(r_kern, r_kruin, NEUS_SLAG, z_dr,
                                                     NEUS_SPOED, NEUS_GANGEN, buiten=True),
                                  engine='manifold')
    hol = omw([(r_kern - 1.6, -1.0), (r_kern - 1.6, z_top + 7.0)])
    stomp = trimesh.boolean.difference([stomp, hol], engine='manifold')
    schoon(stomp, 'PWS_Waterraket_Test_Neusstomp_%02d.stl' % round(spel * 10))
