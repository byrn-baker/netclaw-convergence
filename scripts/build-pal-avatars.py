#!/usr/bin/env python3
"""Blender source for NetClaw's two original local Pal rigs (no downloads).

blender --background --factory-startup --python scripts/build-pal-avatars.py
The live Blender session is never modified. Rebuilds only public/pal built-ins.
"""
import json
import math
from pathlib import Path
import random
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'ui/netclaw-visual/public/pal'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(144)


def material(name, color, roughness=.6, metal=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    return mat


def parent_at(name, position, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    bpy.context.view_layer.update()
    if parent:
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
    return obj


def attach(obj, parent):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix
    return obj


def ellipsoid(name, position, size, mat, parent, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12 if name == 'beard_strand' else 24,
                                        ring_count=8 if name == 'beard_strand' else 16, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return attach(obj, parent)


def tube(name, points, radius, mat, parent):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for point, xyz in zip(spline.bezier_points, points):
        point.co = xyz
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return attach(obj, parent)


def base():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    root = parent_at('pal_root', (0, 0, 0))
    return root


def john():
    root = base()
    skin = material('John warm skin', (.62, .32, .23), .76)
    skin_light = material('Skin highlight', (.71, .40, .29), .74)
    navy = material('Navy shirt', (.022, .065, .12), .82)
    collar = material('Denim collar', (.055, .13, .22), .75)
    silver = material('Silver beard', (.23, .22, .20), .94)
    dark_beard = material('Beard shadow', (.075, .055, .040), .95)
    hair = material('Brown hair', (.028, .014, .008), .93)
    white = material('Eye white', (.89, .9, .86), .35)
    iris = material('Hazel iris', (.10, .12, .075), .4)
    black = material('Pupils', (.008, .014, .019), .25)
    mouth = material('Mouth interior', (.055, .009, .014), .9)
    teeth = material('Smile', (.88, .84, .73), .65)
    ellipsoid('shirt', (0, .08, .57), (.85, .39, .66), navy, root)
    ellipsoid('shoulder_left', (-.66, .06, .66), (.34, .34, .39), navy, root)
    ellipsoid('shoulder_right', (.66, .06, .66), (.34, .34, .39), navy, root)
    ellipsoid('neck', (0, .0, 1.08), (.24, .25, .31), skin, root)
    for side in [-1, 1]:
        ellipsoid('shirt_collar', (side * .23, -.32, 1.0), (.22, .047, .105), collar, root, (0, side * -.5, 0))
    for z in [.3, .48, .66, .84]:
        ellipsoid('button', (0, -.315, z), (.022, .018, .022), white, root)
    for x in [-.65, -.45, -.25, .22, .42, .63]:
        for z in [.35, .51, .67, .83]:
            y = .08 - .39 * math.sqrt(max(.01, 1 - (x/.9)**2 - ((z-.57)/.75)**2))
            ellipsoid('shirt_dot', (x, y-.013, z), (.008, .01, .011), white, root)
    head = parent_at('pal_head', (0, 0, 1.68), root)
    ellipsoid('face', (0, 0, 1.72), (.49, .38, .61), skin, head)
    for side in [-1, 1]:
        ellipsoid('ear', (side*.48, .0, 1.71), (.1, .12, .18), skin_light, head)
        ellipsoid('cheek', (side*.27, -.27, 1.61), (.18, .15, .17), skin_light, head)
    # A swept dark hairstyle and salt-and-pepper beard evoke the supplied photo.
    ellipsoid('hair_back', (0, .14, 2.03), (.49, .32, .35), hair, head)
    for i in range(8):
        x = (i - 3.5)*.105
        ellipsoid('hair_sweep', (x, -.06, 2.205 + .05*math.cos(x*6)), (.16, .27, .12), hair, head, (0, -.20, -.13))
    for side in [-1, 1]:
        ellipsoid('temple_hair', (side*.44, .015, 1.96), (.07, .20, .22), hair, head)
    jaw = parent_at('pal_jaw', (0, 0, 1.5), head)
    ellipsoid('beard_mass', (0, -.07, 1.32), (.435, .36, .39), dark_beard, jaw)
    for i in range(240):
        theta = random.uniform(-1.3, 1.3)
        z = random.uniform(1.04, 1.52)
        radius = .37 * (1 - .32 * abs(z-1.34)/.32)
        x = radius * math.sin(theta)
        y = -.07 - radius * math.cos(theta)
        ellipsoid('beard_strand', (x, y, z), (.012, .025, random.uniform(.04, .075)), silver if i % 4 else dark_beard, jaw, (0, random.uniform(-.22,.22),0))
    for side in [-1, 1]:
        ellipsoid('side_beard', (side*.36, -.2, 1.49), (.10, .16, .19), dark_beard, head)
        eye = parent_at('pal_eye_left' if side < 0 else 'pal_eye_right', (side*.19, -.329, 1.83), head)
        ellipsoid('eye_white', (side*.19, -.344, 1.83), (.116, .061, .071), white, eye)
        ellipsoid('iris', (side*.19, -.402, 1.83), (.043, .015, .048), iris, eye)
        ellipsoid('pupil', (side*.19, -.415, 1.83), (.021, .01, .031), black, eye)
        ellipsoid('eye_glint', (side*.19-.011, -.425, 1.846), (.012, .006, .012), white, eye)
        tube('eyebrow', [(side*.085, -.38, 1.965), (side*.19, -.382, 1.99), (side*.30, -.327, 1.958)], .026, hair, head)
    ellipsoid('nose', (0, -.395, 1.724), (.094, .112, .13), skin_light, head)
    ellipsoid('pal_mouth', (0, -.436, 1.54), (.183, .036, .047), mouth, head)
    ellipsoid('teeth', (0, -.463, 1.559), (.13, .013, .023), teeth, head)
    for side in [-1, 1]:
        ellipsoid('moustache', (side*.113, -.408, 1.606), (.134, .077, .046), dark_beard, head, (0, side*.12, 0))
    return root


def lobster():
    root = base()
    shell = material('Lobster coral', (.55, .018, .006), .34)
    bright = material('Claw vermilion', (.8, .065, .008), .32)
    belly = material('Warm shell plates', (.88, .22, .065), .44)
    white = material('Eye cream', (.94, .94, .8), .28)
    pupil = material('Deep sea pupils', (.009, .024, .031), .16)
    dark = material('Mouth and joints', (.075, .008, .008), .7)
    ellipsoid('carapace', (0, .08, 1.06), (.43, .34, .67), shell, root)
    for i in range(5):
        z = .43 + i*.16
        ellipsoid('belly_plate', (0, -.205, z), (.30 + .02*i, .13, .12), belly, root)
    for side in [-1, 0, 1]:
        ellipsoid('tail_fan', (side*.22, .02, .21), (.23, .16, .20), bright, root, (0, side*-.43, 0))
    for side in [-1, 1]:
        for i in range(3):
            z = .48 + i*.2
            tube('walking_leg', [(side*.29, .01, z+.16), (side*.62, -.04, z), (side*.75, -.25, z-.1)], .043, shell, root)
        hand = parent_at('pal_hand_left' if side < 0 else 'pal_hand_right', (side*.42, 0, 1.2), root)
        tube('claw_arm', [(side*.36, 0, 1.16), (side*.67, -.01, 1.05), (side*.9, -.08, 1.30)], .10, shell, hand)
        ellipsoid('claw_palm', (side*.97, -.08, 1.44), (.25, .18, .32), bright, hand, (0, side*.28, 0))
        tube('pincer_outer', [(side*1.1, -.08, 1.55), (side*1.19, -.08, 1.88), (side*.99, -.09, 2.01)], .085, bright, hand)
        tube('pincer_inner', [(side*.83, -.08, 1.55), (side*.80, -.08, 1.76), (side*.95, -.09, 1.90)], .07, belly, hand)
    head = parent_at('pal_head', (0, 0, 1.54), root)
    ellipsoid('head_shell', (0, -.03, 1.57), (.45, .37, .37), bright, head)
    for side in [-1, 1]:
        tube('eye_stalk', [(side*.20, -.10, 1.74), (side*.26, -.16, 2.015)], .057, shell, head)
        eye = parent_at('pal_eye_left' if side < 0 else 'pal_eye_right', (side*.26, -.16, 2.015), head)
        ellipsoid('eye_white', (side*.26, -.17, 2.015), (.14, .13, .18), white, eye)
        ellipsoid('pupil', (side*.26, -.292, 2.015), (.065, .025, .092), pupil, eye)
        ellipsoid('eye_glint', (side*.26-.024, -.315, 2.055), (.022, .013, .027), white, eye)
        tube('antenna', [(side*.15, .06, 1.84), (side*.32, .045, 2.35), (side*.63, .02, 2.47)], .022, shell, head)
        ellipsoid('antenna_tip', (side*.63, .02, 2.47), (.045, .045, .045), belly, head)
    ellipsoid('pal_mouth', (0, -.382, 1.54), (.13, .03, .042), dark, head)
    ellipsoid('smile_tooth', (0, -.413, 1.56), (.075, .012, .014), white, head)
    return root


def save(name, root):
    scene = bpy.context.scene
    scene.world.color = (.16, .16, .16)
    # Keep animated node identities; combine static parts to reduce draw calls.
    groups = {}
    for obj in root.children_recursive:
        if obj.type == 'MESH' and obj.name != 'pal_mouth':
            groups.setdefault((obj.parent.name, tuple(mat.name for mat in obj.data.materials)), []).append(obj)
    for group in groups.values():
        if len(group) < 2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for obj in root.children_recursive:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{name}.glb'), export_format='GLB',
                              use_selection=True, export_yup=True, export_cameras=False,
                              export_lights=False, export_animations=False)
    # Deterministic studio preview also makes rebuilding the assets reviewable.
    bpy.ops.object.camera_add(location=(.20, -5.8, 2.15))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 1.25)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 3.25
    scene.camera = camera
    for position, energy, size in [((-3, -4, 5), 550, 4), ((3, -2, 3), 360, 3), ((0, 3, 4), 650, 2)]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, 1.3)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)


for name, builder in [('john', john), ('lobster', lobster)]:
    save(name, builder())
(OUT / 'manifest.json').write_text(json.dumps({
    'version': 1, 'rig': 'netclaw-pal-nodes-v1',
    'avatars': [
        {'id': 'john', 'name': 'John', 'file': 'john.glb', 'preview': 'john.png', 'description': 'Stylized John; AI avatar, not a live person.'},
        {'id': 'lobster', 'name': 'Lobster', 'file': 'lobster.glb', 'preview': 'lobster.png', 'description': 'NetClaw lobster companion.'},
    ],
}, indent=2) + '\n')
