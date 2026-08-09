#!/usr/bin/env python3
"""
Genereert de payloadhouder voor de waterraket-vluchtcomputer.

  ESP32-S3-Touch-LCD-1.69  +  druksensor (BMP388 of BME680)  +  LiPo

Pas de maten hieronder aan (schuifmaat!) en draai opnieuw:
    ./.venv/bin/python genereer_houder.py
Print met de bodem op het bed; supports zijn niet nodig.
"""
import numpy as np, trimesh

# ---------------- maten in mm ----------------
BOARD_W, BOARD_L, BOARD_PLAY = 38.0, 38.0, 0.8   # bord (meten!)
BACK_CLEAR = 6.5      # vrije ruimte onder de print (USB-C, componenten)
BOARD_T    = 1.6      # dikte print
CLIP_GRIP  = 1.4      # hoeveel de clip over de rand pakt
CLIP_H     = 1.6      # hoogte cliphaak boven de print

BATT_W, BATT_L, BATT_T, BATT_PLAY = 21.0, 26.0, 10.0, 1.2

# ruim vak: past voor CJMCU-388 (BMP388) en CJMCU-680 (BME680)
SENS_W, SENS_L, SENS_T, SENS_PLAY = 17.0, 23.0, 7.5, 1.0

WALL, BASE, POST = 2.0, 2.0, 5.0
LEDGE, LEDGE_T   = 2.6, 1.6
MARGIN, GAP, PGAP = 5.0, 5.0, 2.0
VENT_D, SCREW_D, STRAP_W = 3.5, 3.4, 12.0

def box(sx, sy, sz, x, y, z):
    """Balk met de linker-voor-onderhoek op (x,y,z)."""
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((x + sx / 2, y + sy / 2, z + sz / 2))
    return m

def cyl(d, h, x, y, z, axis):
    m = trimesh.creation.cylinder(radius=d / 2, height=h, sections=32)
    if axis == 'x':
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    elif axis == 'y':
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    m.apply_translation((x, y, z))
    return m

# ---------------- afgeleide maten ----------------
bw, bl = BOARD_W + 2 * BOARD_PLAY, BOARD_L + 2 * BOARD_PLAY
batt_pw, batt_pl = BATT_W + 2 * BATT_PLAY + 2 * WALL, BATT_L + 2 * BATT_PLAY + 2 * WALL
sens_pw, sens_pl = SENS_W + 2 * SENS_PLAY + 2 * WALL, SENS_L + 2 * SENS_PLAY + 2 * WALL
pockets_w, pockets_l = batt_pw + PGAP + sens_pw, max(batt_pl, sens_pl)
plate_w = max(bw + 2 * POST, pockets_w)
plate_l = MARGIN + pockets_l + GAP + bl + MARGIN
h_top   = BACK_CLEAR + BOARD_T + CLIP_H

bx0, by0 = (plate_w - bw) / 2, plate_l - MARGIN - bl
bx1, by1 = bx0 + bw, by0 + bl
clx0   = (plate_w - pockets_w) / 2
batt_x, sens_x, pock_y = clx0, clx0 + batt_pw + PGAP, MARGIN

adds, subs = [], []
adds.append(box(plate_w, plate_l, BASE, 0, 0, 0))                     # bodemplaat

# vier hoekclips
for sx, sy, cx, cy in ((1, 1, bx0, by0), (-1, 1, bx1, by0),
                       (1, -1, bx0, by1), (-1, -1, bx1, by1)):
    px = cx if sx > 0 else cx - POST
    py = cy if sy > 0 else cy - POST
    adds.append(box(POST, POST, BASE + h_top, px - (POST if sx > 0 else 0),
                    py - (POST if sy > 0 else 0), 0))
    lx = cx if sx > 0 else cx - LEDGE
    ly = cy if sy > 0 else cy - LEDGE
    adds.append(box(LEDGE, LEDGE, LEDGE_T, lx, ly, BASE + BACK_CLEAR - LEDGE_T))
    gx = cx if sx > 0 else cx - CLIP_GRIP
    adds.append(box(CLIP_GRIP, POST, CLIP_H, gx,
                    cy - (0 if sy > 0 else POST), BASE + BACK_CLEAR + BOARD_T))

def pocket(px, py, pw, pl, ph, vent=False):
    adds.append(box(pw, pl, BASE + ph, px, py, 0))
    subs.append(box(pw - 2 * WALL, pl - 2 * WALL, ph + 1, px + WALL, py + WALL, BASE))
    subs.append(box(5, WALL + 1, 3.5, px + pw / 2 - 2.5, py + pl - WALL - 0.5, BASE + ph - 3.5))
    if vent:                                   # twee statische openingen
        subs.append(cyl(VENT_D, WALL + 2, px + pw / 2, py + WALL / 2, BASE + ph / 2, 'y'))
        subs.append(cyl(VENT_D, WALL + 2, px + WALL / 2, py + pl / 2, BASE + ph / 2, 'x'))

pocket(batt_x, pock_y, batt_pw, batt_pl, BATT_T)
pocket(sens_x, pock_y, sens_pw, sens_pl, SENS_T, vent=True)

for side in (-1, 1):                            # montage-oren
    ew, et, el = 10.0, BASE + 1.5, 16.0
    ex = -ew + 0.5 if side < 0 else plate_w - 0.5
    adds.append(box(ew, el, et, ex, plate_l / 2 - el / 2, 0))
    subs.append(cyl(SCREW_D, et + 2, ex + ew / 2, plate_l / 2 - el * 0.20, et / 2, 'z'))
    subs.append(box(4, 6, et + 2, ex + ew / 2 - 2, plate_l / 2 + el * 0.12, -1))

# spanbandsleuven en gewichtsbesparing
subs.append(box(STRAP_W, 2.5, BASE + 2, clx0 + pockets_w / 2 - STRAP_W / 2, pock_y - 1.6, -1))
subs.append(box(STRAP_W, 2.5, BASE + 2, clx0 + pockets_w / 2 - STRAP_W / 2, pock_y + pockets_l - 1.0, -1))
subs.append(box(bw - 10, bl - 10, BASE + 2, bx0 + 5, by0 + 5, -1))

mesh = trimesh.boolean.union(adds, engine='manifold')
mesh = trimesh.boolean.difference([mesh] + subs, engine='manifold')
mesh.export('PWS_Waterraket_Houder.stl')

e = mesh.bounding_box.extents
print("waterdicht: %s | driehoeken: %d" % (mesh.is_watertight, len(mesh.faces)))
print("afmetingen: %.1f x %.1f x %.1f mm" % tuple(e))
print("volume: %.2f cm3 (~%.1f g PLA bij 25%% infill)" % (mesh.volume / 1000, mesh.volume / 1000 * 1.24 * 0.4))
