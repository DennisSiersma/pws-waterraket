#!/usr/bin/env python3
"""
Verwisselbare neuzen die IN de recovery-romp geschroefd worden.

Drie vormen, zodat neusvorm een onderzoeksvariabele kan worden:

  ogief        klassiek raketprofiel, gaat rakend over in de romp
  kegel        rechte kegel, eenvoudigst en zwaarste weerstand
  elliptisch   stomper, kortere en vollere neus

Alle drie hebben dezelfde grove schroefdraad (spoed 5 mm, drie gangen) en een
kraag die op de rand van de romp landt. Een kwartslag is genoeg om ze te
wisselen, dus je kunt op het veld tussen vormen wisselen.

Waarom een grove meergangs draad: fijne geprinte draad is gevoelig voor
laaglijnen en loopt snel vast. Drie gangen met 5 mm spoed pakken meteen en
lopen soepel, ook als de print niet perfect is.

Printen: staand met de punt omhoog, geen supports. De draad zit onderaan en
print als een flauwe overhang. PETG, 0,2 mm laagjes, 3 wanden.

Draaien:  ../../.venv/bin/python genereer_neuzen.py
"""
import numpy as np
import trimesh

# ---------------- moet overeenkomen met genereer_recovery.py ----------------
FLES_D, FLES_SPEL, WAND = 88.5, 1.0, 1.6
NEUS_SPOED, NEUS_GANGEN, NEUS_SLAG, NEUS_DIEPTE = 5.0, 3, 12.0, 1.5
NEUS_SPEL = 0.35

ID = FLES_D + FLES_SPEL          # boring van de romp
OD = ID + 2 * WAND
R_IN = ID / 2

KRAAG_H = 3.0                    # kraag die op de romprand landt
DRAAD_START = 2.0                # begint zover boven de kraag
WAND_NEUS = 2.0
SEG = 96

# (naam, hoogte, vorm)
VORMEN = [
    ("Ogief",      115.0, "ogief"),
    ("Kegel",      115.0, "kegel"),
    ("Elliptisch",  85.0, "ellips"),
]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def draadgang(r_kern, r_kruin, hoogte, z0, spoed, gangen):
    """Buitendraad: de rug steekt naar BUITEN, van r_kern naar r_kruin."""
    kruin, flank = spoed * 0.14, spoed * 0.26
    prof = [(r_kern - 0.4, -(kruin + flank)), (r_kruin, -kruin),
            (r_kruin, kruin), (r_kern - 0.4, kruin + flank)]
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


def straal(vorm, x, r0):
    """x loopt van 0 (basis) tot 1 (punt); geeft de straal."""
    if vorm == "kegel":
        return r0 * (1 - x)
    if vorm == "ellips":
        return r0 * np.sqrt(max(0.0, 1 - x ** 2))
    return r0 * np.sqrt(max(0.0, 1 - x ** 2)) ** 0.72      # ogief


def bouw(naam, hoogte, vorm):
    r_kern = R_IN - NEUS_DIEPTE + NEUS_SPEL      # kern van de draad
    r_kruin = R_IN - NEUS_SPEL                   # rug van de draad
    r_kraag = OD / 2

    # Volgorde van ONDER naar BOVEN: eerst het draaddeel (dat gaat de romp in),
    # dan de kraag die op de romprand landt, dan pas de neusvorm.
    z_dr = 1.0                                   # draad van 1 tot 13 mm
    z_kraag0 = z_dr + NEUS_SLAG + 1.0            # 14
    z_body = z_kraag0 + KRAAG_H                  # 17: hier begint de vorm

    prof = [(r_kern, 0.0), (r_kern, z_kraag0),
            (r_kraag, z_kraag0), (r_kraag, z_body)]
    n = 48
    for i in range(n + 1):
        x = i / n
        r = straal(vorm, x, r_kraag)
        prof.append((max(r, 0.5), z_body + x * hoogte))
    body = omw(prof)

    delen = [body] + draadgang(r_kern, r_kruin, NEUS_SLAG, z_dr,
                               NEUS_SPOED, NEUS_GANGEN)
    neus = trimesh.boolean.union(delen, engine='manifold')

    # uithollen: scheelt gewicht en printtijd
    binnen = [(r_kern - WAND_NEUS, -1.0), (r_kern - WAND_NEUS, z_body)]
    for i in range(n + 1):
        x = i / n
        r = straal(vorm, x, r_kraag) - WAND_NEUS
        if r < 2.0:
            break
        binnen.append((r, z_body + x * hoogte))
    neus = trimesh.boolean.difference([neus, omw(binnen)], engine='manifold')

    neus.merge_vertices(); neus.update_faces(neus.nondegenerate_faces())
    neus.update_faces(neus.unique_faces()); neus.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(neus); trimesh.repair.fix_normals(neus)

    best = 'PWS_Waterraket_Neus_%s.stl' % naam
    neus.export(best)
    t = trimesh.load(best)
    e = t.bounding_box.extents
    print("%-34s %5.1f x %5.1f x %5.1f mm  %5.1f cm3 (~%2.0f g PETG)  waterdicht: %s"
          % (best, e[0], e[1], e[2], t.volume / 1000,
             t.volume / 1000 * 1.27 * 0.4, t.is_watertight))
    return t


print("draad: spoed %.1f mm, %d gangen, kern %.1f / rug %.1f mm\n"
      % (NEUS_SPOED, NEUS_GANGEN, (R_IN - NEUS_DIEPTE + NEUS_SPEL) * 2,
         (R_IN - NEUS_SPEL) * 2))
for naam, h, v in VORMEN:
    bouw(naam, h, v)
