# -*- coding: utf-8 -*-
"""
Estudio de Prompts das Figurinhas -- ferramenta de desenvolvimento (local).

Sobe http://localhost:5002 com a tela dos prompts (animais, frutas, legumes,
comidas, lendas, elementos). Cada card tem: prompt pronto pra colar no ChatGPT,
curiosidade, botao "marcar pronta" (persistido em disco) e UPLOAD da imagem
gerada -- que cai direto em assets/stickers/<secao>/<slug>.png e aparece no card.

NAO faz parte do site. Roda so na sua maquina.
Rodar:  venv\\Scripts\\python.exe tools\\prompts_studio.py   (ou: python tools\\prompts_studio.py)
"""
import os, re, sys, json, glob, unicodedata, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

_VENV_PY = os.path.join(ROOT, "venv", "Scripts", "python.exe")
if os.path.exists(_VENV_PY) and os.path.abspath(sys.executable).lower() != os.path.abspath(_VENV_PY).lower():
    os.execv(_VENV_PY, [_VENV_PY] + sys.argv)

PROGRESS = os.path.join(ROOT, "tools", "_prompts_progress.json")
STICKERS = os.path.join(ROOT, "assets", "stickers")
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")


def _node(js):
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))


def load_data():
    fig = _node("console.log(JSON.stringify(require('./figurinhas_data.js')))")
    paises = _node("let t=require('fs').readFileSync('countries.js','utf8').replace('const countries','globalThis.countries');"
                   "eval(t);console.log(JSON.stringify(Object.fromEntries(countries.map(c=>[c.codigo,c.nome]))))")
    return fig, paises


FIG, PAISES = load_data()
HAB = (FIG.get("animais") or {}).get("hab") or {}   # slug -> frase do bioma (fundo da figurinha)


def slug_name(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def key_for(sec, it):
    return it.get("slug") or (it["code"] + "-" + slug_name(it["nome"]))


def rel_file(sec, it):
    if sec == "lendas":
        return "lendas/" + it["code"] + "-" + slug_name(it["nome"])
    if it.get("slug"):
        return sec + "/" + it["slug"]
    return sec + "/" + it["code"]


# --------- prompt (mesma logica da tela) ---------
BASE = "\n".join([
    "Collectible sticker illustration in a warm mid-century travel-poster style: flat vector shapes,",
    "limited teal/cream/ochre-leaning palette, thick clean edges, soft flat shadows, a subtle",
    "paper grain, big friendly forms. Single clear subject centered, filling ~70% of the frame,",
    "simple complementary background (one soft shape, sky or gradient in the subject's local colors).",
    "Bold and readable as a small card. No photorealism, no 3D render, no text, no letters, no",
    "numbers, no border, no watermark, no flag. Deliver 1200x800 PNG.",
    "--- SUBJECT: ",
])
BASE_LEN = "\n".join([
    "Bold flat vector illustration in a warm mid-century travel-poster / collectible-sticker style:",
    "thick clean edges, limited flat colour, soft flat shadows, a subtle paper grain.",
    "No photorealism, no 3D render, no border, no watermark, no caption text.",
    "The only lettering allowed is the number on the player's shirt. Deliver 1200x800 PNG.",
    "--- SUBJECT: ",
])
BASE_GEMINI = "\n".join([
    "Highly detailed semi-realistic digital painting in a polished, cinematic illustration style -- roughly 75% photorealistic.",
    "Think refined concept-art / cover portrait: the rendering should read as convincingly real in skin, light and fabric,",
    "while keeping a subtle hand-painted, illustrated quality so it is clearly NOT a photograph. Use soft realistic lighting",
    "with a gentle cinematic key light and soft shadows, realistic subsurface skin shading, fine skin texture (subtle pores,",
    "faint imperfections, natural blush), individually rendered hair strands, and soft specular highlights. Linework: minimal",
    "and very subtle -- no thick uniform ink outlines, no hard cel-shading, no flat comic look. Rich, natural, saturated",
    "colour with smooth painterly gradients. Stylised realism, painterly not photographic. NOT a flat vector, NOT a sticker,",
    "NOT a cartoon, NOT a hard-inked comic, NOT a 3D render, NOT a real photograph. No border, no watermark, no caption text.",
    "The only lettering allowed is the number on the player's shirt. Deliver 1200x800 PNG.",
    "--- SUBJECT: ",
])

# reforco: o escudo tem que ser o brasao REAL da federacao (vale nos dois estilos)
CREST = ("The crest on the shirt must be the REAL %s football-federation badge -- accurate shape, colours and central "
         "emblem, only simplified to suit the era, never a generic, blank or invented badge -- and no modern sponsor logos")

# instrucao de fundo (bandeira em duas camadas) reaproveitada nos dois estilos
def _flag_block(pais, flagdesc):
    return (
        "BACKGROUND -- read carefully. The backdrop is the real national flag of %s, painted as one perfectly flat "
        "rectangle that fills the WHOLE frame, edge to edge (it is the wall behind him, not an object beside him). "
        "Use the TRUE flag colours and layout: %s. "
        "Build the image in two layers: BOTTOM layer = that flag, drawn once, centred on the frame, never moved, never "
        "mirrored, never rescaled, never rearranged; TOP layer = the player, painted over it. Wherever the player's body "
        "overlaps the flag, the flag is simply hidden behind him at that spot -- that is correct and expected. Do NOT "
        "slide, shift, duplicate, shrink or nudge any stripe, cross, sun, star, crescent, circle or crest so that it "
        "peeks out beside the player. If the player fully covers the central emblem, leave it fully covered. "
        "The flag has no waves, no folds, no shadows." % (pais, flagdesc))


def _lenda_bits(it):
    kit = (FIG["lendas"].get("kits") or {}).get(it["code"], it["pais"] + " national-team colours")
    flagdesc = (FIG["lendas"].get("flags") or {}).get(it["code"], "the real national flag of " + it["pais"])
    return kit, flagdesc


def subject_gpt(sec, it):
    if sec == "animais":
        return "the %s, in a friendly alert pose, a hint of its natural habitat behind it" % it["en"]
    if sec == "frutas":
        return "a %s, one whole piece and one cross-section, resting on a leaf" % it["en"]
    if sec == "legumes":
        return "a single fresh %s, just picked, with a little soil still on it" % it["en"]
    if sec == "comidas":
        return "%s, plated appetisingly, three-quarter view, a thin wisp of steam" % it["en"]
    if sec == "lendas":
        kit, flagdesc = _lenda_bits(it)
        crest = CREST % it["pais"]
        if it.get("gk"):
            jersey = "a goalkeeper jersey with an era-appropriate %s cut; %s" % (it["era"], crest)
        else:
            jersey = ("the %s national-team home jersey in the style of a %s kit (era-appropriate cut and fabric, %s; %s)"
                      % (it["pais"], it["era"], kit, crest))
        return (
            "a bold flat vector travel-poster portrait of the footballer %s of %s. "
            "Make the face and build a recognisable, faithful stylised likeness of the real %s: %s. "
            "Shown from the chest up in a confident heroic three-quarter pose, wearing %s, "
            "with the number %s clearly on the shirt.\n%s\n"
            "Sticker-album illustration style, not photorealistic; iconic and readable as a small card."
            % (it["nome"], it["pais"], it["nome"], it["fis"], jersey, it["num"], _flag_block(it["pais"], flagdesc)))
    return ""


def subject_gemini(it):
    kit, flagdesc = _lenda_bits(it)
    crest = CREST % it["pais"]
    if it.get("gk"):
        jersey = ("the %s goalkeeper jersey in a %s cut (era-appropriate fabric with visible texture and stitching; %s), "
                  "with the number %s clearly on the shirt" % (it["pais"], it["era"], crest, it["num"]))
    else:
        jersey = ("the %s national-team home jersey in a %s cut (era-appropriate fabric with visible mesh texture and "
                  "stitching, %s; %s), with the number %s clearly on the shirt"
                  % (it["pais"], it["era"], kit, crest, it["num"]))
    return (
        "a heroic three-quarter-view portrait of the footballer %s of %s, shown from the chest up in a confident, athletic "
        "pose, head turned slightly to the side with an intense focused gaze. Make the face a detailed, highly recognisable, "
        "faithful likeness of the real %s: %s. Render the face with photographic-level detail and correct proportions -- "
        "defined features, realistic eyes and skin -- while preserving the painterly illustration finish. He wears %s.\n%s\n"
        "Semi-realistic painterly sports-poster portrait, detailed and cinematic, reading as ~75%% realism between a "
        "photograph and an illustration."
        % (it["nome"], it["pais"], it["nome"], it["fis"], jersey, _flag_block(it["pais"], flagdesc)))


# ---- animais em extincao: mesmo estilo cinematografico das lendas, fundo = bioma real ----
BASE_ANIM = "\n".join([
    "Highly detailed semi-realistic digital painting in a polished, cinematic wildlife-illustration style -- roughly 75% photorealistic.",
    "Think refined natural-history cover art: convincingly real fur, feathers, scales, skin, eyes and light, while keeping a subtle",
    "hand-painted, illustrated quality so it is clearly NOT a photograph. Soft realistic lighting with a gentle cinematic key light",
    "and soft shadows, fine texture (individual hairs, feather barbs, scale detail), a moist catchlight in the eye, soft specular",
    "highlights. Linework minimal and very subtle -- no thick uniform outlines, no hard cel-shading, no flat comic look. Rich,",
    "natural, saturated colour with smooth painterly gradients. Stylised realism, painterly not photographic. NOT a flat vector,",
    "NOT a sticker, NOT a cartoon, NOT a hard-inked comic, NOT a 3D render, NOT a real photograph. No text, no letters, no numbers,",
    "no border, no watermark, no signature, no logo, no flag, no people, no hands, no cages or fences. One single complete",
    "animal, full body visible and uncropped, centred, calm and dignified. Deliver 1200x800 PNG (3:2 landscape).",
    "--- SUBJECT: ",
])


def _habitat_block(hab):
    return (
        "BACKGROUND -- the setting is the animal's REAL habitat: %s. "
        "Paint it as a believable environment that fills the WHOLE frame, edge to edge, as the world behind the animal. "
        "Build the image in two layers: BOTTOM layer = that habitat, painted once; TOP layer = the animal, painted over it. "
        "Keep the background slightly soft / gently depth-blurred and a touch darker so the animal clearly stands out in front. "
        "Match the plants, rock, water, snow, light and season to that exact biome -- never mix in scenery from a different "
        "biome (no forest behind a desert animal, no savanna behind a rainforest animal, no ice behind a jungle animal). "
        "Natural daylight unless the habitat text says night. Nothing man-made, no other large animals." % hab
    )


# correções pontuais depois da revisão das 225 imagens geradas (10/09): a IA
# confundiu 2 espécies com parentes mais famosos. Fica só o texto extra de
# anatomia pra essas -- o resto do prompt (pose, bioma, estilo) é igual.
ANIM_ANATOMY_FIX = {
    "perereca-lemur": (
        "ANATOMY -- be careful, this is the lemur leaf frog, NOT the much more famous red-eyed tree frog: its eyes "
        "are bronze/coppery-brown with a HORIZONTAL pupil, never red or orange, and never a vertical cat-like pupil. "
        "Body pale grey-green to olive at rest (it can shift towards brown), slender and willowy rather than plump, "
        "resting flat and low against a broad leaf with its legs tucked tight along its sides so it reads as a smooth "
        "leaf-like outline, not sitting upright. No red, no orange eyes, no vertical pupil anywhere."
    ),
    "estrela-do-mar-girassol": (
        "ANATOMY -- be careful, a sea star has NO face: no eyes, no pupils, no nose, no mouth visible from above, "
        "nothing that reads as a head. It is a soft, fleshy, radially symmetric disc with a thick granular/bumpy "
        "surface (short soft spines, not smooth) in mottled orange, purple and brown, from which 16 to 24 short "
        "tapering arms radiate evenly all the way around like a many-pointed star, seen from above or a gentle "
        "three-quarter-above angle so the whole radial star shape and every arm is visible. Do not draw eyes, a "
        "face, or an octopus-like head at the centre -- only the plain fleshy disc where the arms meet."
    ),
}


def subject_anim(it):
    hab = HAB.get(it.get("slug") or "") or "its natural habitat"
    fix = ANIM_ANATOMY_FIX.get(it.get("slug") or "")
    return (
        "the complete %s shown FULL BODY from head to tail and feet, nothing cropped, in a natural relaxed pose "
        "(standing, walking, perched, climbing, swimming or resting as suits the species), seen from a gentle "
        "three-quarter angle, the animal filling about 60-70%% of the frame and sitting comfortably inside it, head "
        "turned slightly toward the viewer with a calm, alert gaze and a clean catchlight in the eye. Render it as a "
        "detailed, accurate, faithful likeness of the real species -- correct anatomy, proportions, markings and "
        "colours, every hair, feather or scale described, like a premium natural-history field-guide plate.\n%s%s\n"
        "Semi-realistic painterly wildlife-poster illustration, detailed and cinematic, reading as ~75%% realism "
        "between a photograph and an illustration; the whole animal iconic and readable as a small collectible card."
        % (it["en"], ("\n" + fix + "\n") if fix else "", _habitat_block(hab))
    )


def prompt_anim(it):
    return BASE_ANIM + subject_anim(it)


# ---- legumes: estilo cinematografico ~75% real dos animais (inalterado) ----
# regra de ouro: NAO inventar ingrediente / variedade -- respeitar a cultura de origem.
BASE_FOOD = "\n".join([
    "Highly detailed semi-realistic digital painting in a polished, cinematic food-illustration style -- roughly 75% photorealistic.",
    "Think refined cookbook-cover / natural-history plate art: convincingly real texture, moisture, crumb, grain, char, steam and",
    "light, while keeping a subtle hand-painted, illustrated quality so it is clearly NOT a photograph. Soft realistic lighting with",
    "a gentle cinematic key light and soft shadows, believable specular highlights and reflections, shallow depth of field. Linework",
    "minimal and very subtle -- no thick uniform outlines, no hard cel-shading, no flat comic look. Rich, natural, appetising colour",
    "with smooth painterly gradients. Stylised realism, painterly not photographic. NOT a flat vector, NOT a sticker, NOT a cartoon,",
    "NOT a hard-inked comic, NOT a 3D render, NOT a real photograph. No text, no letters, no numbers, no border, no watermark, no",
    "signature, no logo, no brand, no flag, no people, no hands. Deliver 1200x800 PNG (3:2 landscape).",
    "--- SUBJECT: ",
])

# ---- comidas tipicas: 100% foto-realista (10/09, "Opcao A" aprovada pelo user) ----
# regra de ouro: NAO inventar ingrediente -- respeitar a cultura de origem.
BASE_COMIDA = "\n".join([
    "A professional editorial food photography shot -- shot on a DSLR camera, 100mm macro lens, f/2.8 aperture, shallow depth of",
    "field with the dish in crisp focus and the background softly blurred. Soft natural window light from one side, gentle",
    "realistic shadows, faint steam rising if the dish is hot, visible glossy texture, moisture and real food surface detail.",
    "100% photorealistic photograph, hyper-detailed, indistinguishable from a real photo taken by a professional food",
    "photographer for a cookbook or restaurant menu -- NOT a painting, NOT an illustration, NOT a digital painting, NOT",
    "3D-rendered, NOT a cartoon, NOT stylised. No text, no letters, no numbers, no border, no watermark, no signature, no logo,",
    "no brand, no flag, no people, no hands. Deliver a 1200x800 photograph (3:2 landscape).",
    "--- SUBJECT: ",
])


def subject_comida(it):
    return (
        "%s, served as a single honest portion on a rustic table, seen from a natural three-quarter angle, filling about "
        "60-70%% of the frame and sitting comfortably inside it.\n"
        "CULTURAL ACCURACY -- read carefully. This is a real national dish and must be shown truthfully: include ONLY the "
        "components named above and nothing else. Do NOT add, swap or imagine any ingredient, garnish, herb, spice, sauce, side, "
        "topping, bread or decoration that is not named. Do NOT turn it into fusion food, do NOT do tall fine-dining tower "
        "plating, do NOT prettify it with scattered micro-herbs or sauce dots. Present it exactly the way it is traditionally "
        "cooked and served at home in its own country -- correct colour, texture, consistency and portion -- in its usual "
        "vessel (plain plate, bowl, clay pot, cast-iron pan, banana leaf, paper, skewer or board, whichever is authentic).\n"
        "BACKGROUND -- a plain, softly blurred neutral surface (simple weathered wood, stone or cloth) under warm natural "
        "light; nothing identifiable behind it, no other dishes, no cutlery unless essential, no props, no text, no flag, no logo.\n"
        "The photograph must be 100%% photorealistic -- real food, real light, real texture -- iconic and instantly readable "
        "as a small collectible card."
        % it["en"]
    )


def subject_legume(it):
    return (
        "%s, shown as the true cultivated plant -- a fresh generous helping of it: one whole specimen for the large ones, or a "
        "small natural pile / bunch / cluster for the small ones (beans, peas, lentils, peanuts, mushrooms, grains), uncropped, "
        "from a gentle three-quarter angle, filling about 55-70%% of the frame, exactly as it looks freshly harvested -- correct "
        "species and common variety, real shape, size, proportions, surface and natural colour, with the true texture of its "
        "skin, leaves, pod or husk. You may add one clean cut half beside the whole one ONLY if that is a normal, familiar way "
        "to show this vegetable.\n"
        "ACCURACY -- do NOT invent a fantasy variety, do NOT change its colour or form, do NOT stylise it into something "
        "decorative, and do NOT add leaves, flowers, roots, tendrils, water drops, seasoning, cloth or props that do not "
        "genuinely belong to this plant.\n"
        "BACKGROUND -- a plain, softly blurred neutral surface (simple wood, stone or earth tones) under soft daylight; nothing "
        "identifiable behind it, no text, no flag, no logo, no people, no hands.\n"
        "Semi-realistic painterly still-life illustration, detailed and cinematic, reading as ~75%% realism between a photograph "
        "and an illustration; the vegetable iconic and instantly readable as a small collectible card."
        % it["en"]
    )


def prompt_food(sec, it):
    if sec == "comidas":
        return BASE_COMIDA + subject_comida(it)
    return BASE_FOOD + subject_legume(it)


# ---- elementos quimicos: mesmo estilo cinematografico ~75% real ----
# v2 (11/09): a v1 pedia "fundo neutro desfocado" -- exatamente a receita de foto
# de produto/e-commerce, o oposto do efeito pintura que os animais conseguem por
# terem um habitat de verdade ao redor. Agora exige uma CENA com ambiente real
# (oficina, laboratorio, ceu noturno, fabrica...) em vez de objeto isolado, e
# proibe explicitamente o "look" de foto de catalogo/estudio.
BASE_ELEM = "\n".join([
    "Highly detailed semi-realistic digital painting in a polished, cinematic illustration style -- roughly 75% photorealistic,",
    "the same painterly 'science encyclopaedia for kids' treatment as a nature-illustration book plate. Convincingly real",
    "material, metal, glass, gas-glow, crystal and light, with VISIBLE hand-painted brushwork so it unmistakably reads as an",
    "illustration -- never as a photograph, and never as a clean rendered product shot.",
    "Full atmospheric SCENE with a real environment and sense of depth around the subject (a workshop, laboratory, factory",
    "floor, night sky, industrial site, outdoors -- whatever truly fits) -- NOT an isolated object floating on a plain blurred",
    "studio background. Dramatic but natural cinematic lighting, rich saturated colour, soft painterly gradients, a sense of",
    "place and mood, like a scene from a storybook.",
    "Absolutely AVOID: product photography, e-commerce / catalogue photo look, plain white or grey seamless backdrop, softbox",
    "studio lighting, sterile stock-photo composition, flat vector, sticker, cartoon, 3D render, cel-shading, thick outlines.",
    "No text, no letters, no numbers, no periodic-table tile or square, no chemical symbol, no border, no watermark, no logo,",
    "no brand, no flag, no people, no hands. One clear main subject filling about 55-65% of the frame, set inside its real",
    "environment. Deliver 1200x800 PNG (3:2 landscape).",
    "--- SUBJECT: ",
])


def subject_elemento(it):
    if it.get("real"):
        head = ("a clean, well-lit sample of the pure chemical element %s shown the way it really looks: %s. Render the true "
                "colour, lustre and texture of the actual element -- do not invent a colour or form." % (it["en"], it["subj"]))
    else:
        head = ("%s -- the everyday object or scene that depends on the element %s. Paint the object realistically and "
                "accurately; the element itself may be invisible (inside the object) and that is fine." % (it["subj"], it["en"]))
    return (head + "\nSemi-realistic painterly illustration, detailed and cinematic, reading as ~75% realism between a "
            "photograph and an illustration; the subject iconic and instantly readable as a small collectible card.")


def prompt_elem(it):
    return BASE_ELEM + subject_elemento(it)


def prompt_for(sec, it):
    if sec == "animais":
        return prompt_anim(it)
    if sec in ("legumes", "comidas"):
        return prompt_food(sec, it)
    if sec == "elementos":
        return prompt_elem(it)
    return (BASE_LEN if sec == "lendas" else BASE) + subject_gpt(sec, it)


def prompt_gemini(it):
    return BASE_GEMINI + subject_gemini(it)


# --------- itens enriquecidos p/ a tela ---------
# seções que NÃO aparecem no estúdio (arte já pronta / não vamos gerar):
HIDE_SECOES = {"clubes"}   # escudos já estão no jogo, baixados por fetch_escudos.py


def build_items():
    out = {}
    for sec, s in FIG.items():
        if sec in HIDE_SECOES:
            continue
        arr = []
        for it in s["itens"]:
            k = key_for(sec, it)
            rf = rel_file(sec, it)
            row = {
                "key": k, "file": rf,
                "titulo": it.get("n") or it.get("nome"),
                "cur": it.get("cur", ""),
                "code": it.get("code"),
                "pais": PAISES.get(it.get("code"), (it.get("code") or "").upper()) if it.get("code") else "",
                "sub": "",
                "prompt": prompt_for(sec, it) if s["tipo"] != "img" else "",
                "prompt_gemini": prompt_gemini(it) if sec == "lendas" else "",
                "busca": it.get("busca", ""),
            }
            if sec == "comidas":
                row["titulo"] = row["pais"]; row["sub"] = it["nome"]
            elif s["tipo"] == "img":
                row["titulo"] = it["nome"]
                row["sub"] = it.get("liga", "")
                row["busca"] = it["nome"] + " football club crest logo"
            elif sec == "lendas":
                row["titulo"] = it["nome"]
                row["pais"] = it["pais"]
                row["sub"] = "%s · camisa nº %s%s" % (it["pais"], it["num"], " (goleiro)" if it.get("gk") else "")
            elif sec == "elementos":
                row["titulo"] = it["n"]
                row["z"] = it["z"]
                row["sub"] = "nº %d · %s · %s" % (it["z"], it["simbolo"], "amostra do elemento" if it.get("real") else "uso")
            arr.append(row)
        if sec == "elementos":
            arr.sort(key=lambda r: r["z"])
        else:
            arr.sort(key=lambda r: (r.get("pais") or "", r["titulo"]) if sec in ("comidas", "lendas")
                     else r["titulo"])
        out[sec] = {"nome": s["nome"], "emoji": s["emoji"], "tipo": s["tipo"], "itens": arr}
    return out


ITEMS = build_items()


def load_progress():
    try:
        return json.load(open(PROGRESS, encoding="utf-8"))
    except Exception:
        return {"done": {}}


def save_progress(p):
    json.dump(p, open(PROGRESS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def scan_images():
    """{sec: {key: 'url'}} olhando o disco -- pega tambem o que voce jogar na pasta na mao."""
    res = {}
    for sec, s in ITEMS.items():
        m = {}
        for it in s["itens"]:
            base = os.path.join(STICKERS, it["file"].replace("/", os.sep))
            for ext in IMG_EXT:
                if os.path.isfile(base + ext):
                    m[it["key"]] = "/sticker/" + it["file"] + ext
                    break
        if m:
            res[sec] = m
    return res


# secao -> lado maior do webp (escudo menor)
_WEBP_SIDE = {"clubes": 400}


def make_webp(base, src_ext):
    """Gera <base>.webp a partir de <base><src_ext> (mesma logica do otimizar_stickers.py)."""
    try:
        from PIL import Image
    except Exception:
        return
    sec = os.path.basename(os.path.dirname(base))
    side = _WEBP_SIDE.get(sec, 640)
    q = 88 if side == 400 else 82
    try:
        im = Image.open(base + src_ext); im.load()
        alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        im = im.convert("RGBA" if alpha else "RGB")
        w, h = im.size
        sc = min(1.0, side / max(w, h))
        if sc < 1.0:
            im = im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
        im.save(base + ".webp", "WEBP", quality=q, method=6)
    except Exception as e:
        print("  (webp falhou:", e, ")")


# ---------------------------------------------------------------- servidor
from flask import Flask, request, jsonify, send_from_directory, Response
import urllib.request, urllib.parse

app = Flask(__name__)
app.json.sort_keys = False

_UA = {"User-Agent": "detetive-global-dev/1.0 (moedas, uso educativo local)"}


def commons_search(term, limit=8):
    """Busca arquivos no Wikimedia Commons (fotos reais, dominio publico/CC) -- devolve
    [{title, thumb, url, page}]. Voce escolhe qual bate com a moeda de verdade; nada
    e salvo sem voce clicar."""
    api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search"
           "&gsrnamespace=6&gsrsearch=%s&gsrlimit=%d&prop=imageinfo&iiprop=url|mime&iiurlwidth=300"
           % (urllib.parse.quote(term), limit))
    req = urllib.request.Request(api, headers=_UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8", "ignore"))
    pages = (data.get("query") or {}).get("pages") or {}
    out = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime") or ""
        if not mime.startswith("image/") or mime == "image/svg+xml":
            continue
        title = p.get("title") or ""
        out.append({
            "title": title,
            "thumb": ii.get("thumburl"),
            "url": ii.get("url"),
            "page": "https://commons.wikimedia.org/wiki/" + title.replace(" ", "_"),
        })
    return out


def save_image_from_url(url, base):
    """Baixa uma imagem (Wikimedia ou qualquer http/https) e salva como <base><ext>,
    mesma logica do upload manual (troca extensao antiga + gera .webp)."""
    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        ctype = (r.headers.get("Content-Type") or "").lower()
    ext = ".jpg" if "jpeg" in ctype else ".png" if "png" in ctype else os.path.splitext(url.split("?")[0])[1].lower()
    if ext not in IMG_EXT:
        ext = ".jpg"
    os.makedirs(os.path.dirname(base), exist_ok=True)
    for e in IMG_EXT:
        if os.path.isfile(base + e):
            os.remove(base + e)
    open(base + ext, "wb").write(data)
    make_webp(base, ext)
    return ext


@app.get("/")
def index():
    return Response(PAGE, mimetype="text/html")


@app.get("/api/data")
def api_data():
    return jsonify({"ordem": list(ITEMS.keys()), "secoes": ITEMS,
                    "progress": load_progress().get("done", {}), "images": scan_images()})


@app.post("/api/done")
def api_done():
    d = request.get_json(force=True)
    sec, key, val = d.get("sec"), d.get("key"), bool(d.get("done"))
    p = load_progress()
    lst = set(p["done"].get(sec, []))
    lst.add(key) if val else lst.discard(key)
    p["done"][sec] = sorted(lst)
    save_progress(p)
    return jsonify({"ok": True})


@app.post("/api/upload")
def api_upload():
    sec = request.form.get("sec")
    key = request.form.get("key")
    f = request.files.get("file")
    item = next((it for it in ITEMS.get(sec, {}).get("itens", []) if it["key"] == key), None)
    if not item or not f:
        return jsonify({"erro": "item ou arquivo invalido"}), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in IMG_EXT:
        ext = ".png"
    base = os.path.join(STICKERS, item["file"].replace("/", os.sep))
    os.makedirs(os.path.dirname(base), exist_ok=True)
    for e in IMG_EXT:                       # remove versao anterior (qualquer extensao)
        if os.path.isfile(base + e):
            os.remove(base + e)
    f.save(base + ext)
    make_webp(base, ext)                    # versao leve .webp pro jogo/deploy
    p = load_progress()                     # upload marca como pronta
    lst = set(p["done"].get(sec, [])); lst.add(key)
    p["done"][sec] = sorted(lst); save_progress(p)
    return jsonify({"ok": True, "url": "/sticker/" + item["file"] + ext + "?t=" + str(os.path.getmtime(base + ext))})


@app.delete("/api/upload")
def api_upload_del():
    d = request.get_json(force=True)
    item = next((it for it in ITEMS.get(d.get("sec"), {}).get("itens", []) if it["key"] == d.get("key")), None)
    if not item:
        return jsonify({"erro": "nao achei"}), 404
    base = os.path.join(STICKERS, item["file"].replace("/", os.sep))
    for e in IMG_EXT:
        if os.path.isfile(base + e):
            os.remove(base + e)
    return jsonify({"ok": True})


@app.get("/api/commons_search")
def api_commons_search():
    q = request.args.get("q") or ""
    if not q.strip():
        return jsonify({"erro": "sem termo de busca"}), 400
    try:
        return jsonify({"ok": True, "results": commons_search(q)})
    except Exception as e:
        return jsonify({"erro": str(e)}), 502


@app.post("/api/commons_fetch")
def api_commons_fetch():
    d = request.get_json(force=True)
    sec, key, url = d.get("sec"), d.get("key"), d.get("url")
    item = next((it for it in ITEMS.get(sec, {}).get("itens", []) if it["key"] == key), None)
    if not item or not url:
        return jsonify({"erro": "item ou url invalido"}), 400
    base = os.path.join(STICKERS, item["file"].replace("/", os.sep))
    try:
        ext = save_image_from_url(url, base)
    except Exception as e:
        return jsonify({"erro": "download falhou: %s" % e}), 502
    p = load_progress()
    lst = set(p["done"].get(sec, [])); lst.add(key)
    p["done"][sec] = sorted(lst); save_progress(p)
    return jsonify({"ok": True, "url": "/sticker/" + item["file"] + ext + "?t=" + str(os.path.getmtime(base + ext))})


@app.get("/sticker/<path:rel>")
def sticker(rel):
    return send_from_directory(STICKERS, rel)


PAGE = r"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Prompts das Figurinhas</title>
<style>
 :root{--bg:#f6f3ec;--sf:#fff;--sf2:#efeadf;--ink:#1b2540;--mut:#7c8598;--line:#e2ddd0;--acc:#b0670a;--good:#12805a;--codebg:#172239;--codeink:#e7ecf6}
 @media(prefers-color-scheme:dark){:root{--bg:#0e1626;--sf:#16233b;--sf2:#1d2c48;--ink:#eef2f8;--mut:#8b9ab2;--line:rgba(255,255,255,.12);--acc:#f0a94a;--good:#55d39b;--codebg:#0b1424}}
 *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif}
 .wrap{max-width:1180px;margin:0 auto;padding:0 18px 90px}
 header{position:sticky;top:0;z-index:9;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 18px}
 .hd{max-width:1180px;margin:0 auto}h1{font-size:1.25rem;margin:0 0 8px}
 .pills{display:flex;flex-wrap:wrap;gap:7px}
 .pill{padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--sf);color:var(--mut);font-weight:800;font-size:.84rem;cursor:pointer}
 .pill.on{background:color-mix(in srgb,var(--acc) 16%,var(--sf));border-color:var(--acc);color:var(--ink)}
 .pill .ct{font-size:.72rem;background:var(--sf2);border-radius:999px;padding:1px 7px;margin-left:6px}
 .bar{display:flex;align-items:center;gap:12px;margin:14px 0 4px}
 .bar .t{flex:1;height:8px;border-radius:999px;background:var(--sf2);overflow:hidden}
 .bar .t span{display:block;height:100%;background:var(--good)}
 .bar .n{font-weight:800;font-size:.82rem;color:var(--mut);white-space:nowrap}
 .pct{display:flex;align-items:baseline;gap:10px;margin:6px 0 2px}
 .pct b{font-size:2rem;font-weight:900;color:var(--good);line-height:1}
 .pct .g{font-size:.8rem;font-weight:800;color:var(--mut)}
 .note{margin:10px 0;padding:10px 13px;border-radius:9px;background:color-mix(in srgb,var(--acc) 9%,var(--sf));border:1px solid color-mix(in srgb,var(--acc) 22%,var(--line));font-size:.82rem}
 input[type=search]{width:100%;max-width:340px;padding:9px 12px;border-radius:9px;border:1px solid var(--line);background:var(--sf);color:var(--ink);font:inherit;margin:8px 0}
 .chk{font-size:.82rem;font-weight:800;color:var(--mut);margin-left:12px}
 .grid{display:grid;gap:14px;margin-top:14px;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
 .card{border:1px solid var(--line);border-radius:12px;background:var(--sf);overflow:hidden;display:flex;flex-direction:column}
 .card.done{opacity:.62}
 .ch{display:flex;gap:10px;padding:12px 14px 6px;align-items:flex-start}
 .fl{font-size:1.5rem;flex-shrink:0}.tt{font-weight:900}.sb{font-size:.8rem;color:var(--acc);font-weight:800}
 .fp{font-size:.72rem;color:var(--mut);font-family:ui-monospace,monospace}
 .db{margin-left:auto;flex-shrink:0;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:var(--sf2);color:var(--mut);font:inherit;font-weight:800;font-size:.72rem;cursor:pointer}
 .card.done .db{background:color-mix(in srgb,var(--good) 20%,transparent);border-color:var(--good);color:var(--good)}
 pre{margin:8px 14px 0;padding:11px 12px;border-radius:8px;background:var(--codebg);color:var(--codeink);font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}
 .cur{margin:8px 14px 0;padding:8px 11px;border-radius:8px;background:var(--sf2);font-size:.82rem}
 .commons-grid{margin:8px 14px 0;padding:8px;border-radius:8px;background:var(--sf2);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
 .cg-item{padding:0;border:2px solid transparent;border-radius:6px;overflow:hidden;cursor:pointer;background:none;width:64px;height:64px;flex-shrink:0}
 .cg-item:hover{border-color:var(--acc)}
 .cg-item img{width:100%;height:100%;object-fit:cover;display:block}
 .cg-msg{font-size:.74rem;color:var(--mut);flex-basis:100%}
 .act{display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px}
 .b{flex:1 1 44%;padding:9px;border-radius:8px;border:1px solid var(--line);background:var(--sf);color:var(--ink);font:inherit;font-weight:800;font-size:.8rem;cursor:pointer;text-align:center;text-decoration:none}
 .b.p{background:var(--acc);border-color:var(--acc);color:#fff}
 .b.g{background:var(--good);border-color:var(--good);color:#fff}
 .thumb{margin:8px 14px 0;border-radius:8px;overflow:hidden;border:1px solid var(--line);position:relative}
 .thumb img{width:100%;display:block;aspect-ratio:3/2;object-fit:cover}
 .thumb .rm{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);color:#fff;border:0;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:.72rem}
 .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:999px;font-weight:800;font-size:.85rem;opacity:0;transition:.2s;pointer-events:none}
 .toast.on{opacity:1}
</style></head><body>
<header><div class="hd"><h1>Prompts das Figurinhas <span style="font-size:.7rem;color:var(--mut);font-weight:600">· estúdio local</span></h1>
 <div class="pills" id="pills"></div></div></header>
<div class="wrap">
 <div class="pct"><b id="pctbig">0%</b><span class="g" id="pctall"></span></div>
 <div class="bar"><div class="t"><span id="bf"></span></div><div class="n" id="bn">0 / 0</div></div>
 <div><input type="search" id="q" placeholder="filtrar..."><label class="chk"><input type="checkbox" id="hd"> ocultar prontas</label></div>
 <div class="note" id="note"></div>
 <div class="grid" id="grid"></div>
</div>
<div class="toast" id="toast"></div>
<script>
const $=s=>document.querySelector(s),api=(u,o)=>fetch(u,o).then(r=>r.json());
let DATA=null,ORDER=[],cur='animais',q='',hideDone=false;
const NOTE={animais:"Figurinha por animal, ordem alfabética, sem bandeira no card. Os países vão na curiosidade.",
 frutas:"Figurinha por fruta.",
 legumes:"Figurinha por legume/hortaliça. Estilo semirrealista ~75% (igual aos animais), variedade real da planta.",
 comidas:"Uma comida por país (prato escolhido por nós). Estilo semirrealista ~75% — só os ingredientes reais do prato, servido como na cultura de origem.",
 elementos:"1 figurinha por elemento (Z 1–98). 'amostra' = mostra o elemento puro; 'uso' = mostra um objeto do dia a dia que depende dele. Estilo semirrealista ~75%. O número atômico e o símbolo entram no card do jogo, não na imagem.",
 lendas:"Craques por país. Prompt já tem nome + físico + uniforme da época + número + fundo com a bandeira.",
 clubes:"Escudos baixados por script: venv\\Scripts\\python.exe tools\\fetch_escudos.py . O que faltar, use o botão de busca ou faça upload."};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._);t._=setTimeout(()=>t.classList.remove('on'),1600);}
function done(sec){return new Set(DATA.progress[sec]||[]);}
function img(sec,k){return (DATA.images[sec]||{})[k];}

function pills(){
 $('#pills').innerHTML=ORDER.map(id=>{const s=DATA.secoes[id];
  const tot=s.itens.length,d=s.itens.filter(it=>done(id).has(it.key)).length;
  return `<button class="pill${id===cur?' on':''}" data-s="${id}">${s.emoji} ${s.nome}<span class="ct">${d}/${tot}</span></button>`;
 }).join('');
 document.querySelectorAll('.pill').forEach(b=>b.onclick=()=>{cur=b.dataset.s;q='';$('#q').value='';pills();render();scrollTo(0,0);});
}
function render(){
 const s=DATA.secoes[cur];$('#note').textContent=NOTE[cur]||'';
 const dn=done(cur),tot=s.itens.length,dc=s.itens.filter(it=>dn.has(it.key)).length;
 const pct=Math.round(dc/tot*100);
 $('#bf').style.width=pct+'%';$('#bn').textContent=dc+' / '+tot+' prontas';
 $('#pctbig').textContent=pct+'%';
 let gt=0,gd=0;ORDER.forEach(id=>{const s=DATA.secoes[id];gt+=s.itens.length;gd+=s.itens.filter(it=>done(id).has(it.key)).length;});
 $('#pctall').textContent='· '+s.nome+'  |  álbum todo: '+Math.round(gd/gt*100)+'% ('+gd+'/'+gt+')';
 let list=s.itens.filter(it=>{
  if(hideDone&&dn.has(it.key))return false;
  if(!q)return true;const h=(it.titulo+' '+it.sub+' '+it.pais+' '+it.cur).toLowerCase();return h.includes(q);
 });
 $('#grid').innerHTML=list.map(it=>card(s,it)).join('');
 list.forEach(it=>wire(s,it));
}
function flag(c){
 if(c==='sct')return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
 if(c==='wls')return '🏴󠁧󠁢󠁷󠁬󠁳󠁿';
 if(!/^[a-z]{2}$/i.test(c||''))return '';c=c.toUpperCase();return String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65)+String.fromCodePoint(0x1F1E6+c.charCodeAt(1)-65);}
function card(s,it){
 const dn=done(cur).has(it.key),url=img(cur,it.key);
 const hl=(it.prompt||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
 return `<div class="card${dn?' done':''}" data-k="${it.key}">
  <div class="ch">${it.code?`<span class="fl">${flag(it.code)}</span>`:''}
   <div style="min-width:0"><div class="tt">${it.titulo}</div>${it.sub?`<div class="sb">${it.sub}</div>`:''}
    <div class="fp">${it.file}.png</div></div>
   <button class="db" data-a="done">${dn?'✓ pronta':'marcar'}</button></div>
  ${url?`<div class="thumb"><img src="${url}"><button class="rm" data-a="rm">remover</button></div>`:''}
  ${it.prompt?`<pre>${hl}</pre>`:''}
  ${it.cur?`<div class="cur">${it.cur}</div>`:''}
  ${it.busca?`<div class="commons-grid hidden" data-role="commons"></div>`:''}
  <div class="act">
   ${it.prompt?`<button class="b p" data-a="copy">${it.prompt_gemini?'Copiar (ChatGPT)':'Copiar prompt'}</button>`:''}
   ${it.prompt_gemini?`<button class="b p" data-a="copyg">Copiar (Gemini)</button>`:''}
   ${it.busca?`<button class="b p" data-a="commons">🔎 Ver fotos reais</button>`:''}
   ${it.busca?`<a class="b" target="_blank" href="https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(it.busca)}&title=Special:MediaSearch&type=image">Buscar manualmente ↗</a>`:''}
   <button class="b" data-a="up">${url?'Trocar imagem':'Upload da imagem'}</button>
   ${it.cur?`<button class="b" data-a="ccur">Copiar curiosidade</button>`:''}
  </div></div>`;
}
function wire(s,it){
 const el=document.querySelector(`.card[data-k="${CSS.escape(it.key)}"]`);if(!el)return;
 el.querySelector('[data-a=done]').onclick=async()=>{
  const nd=!done(cur).has(it.key);
  await api('/api/done',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sec:cur,key:it.key,done:nd})});
  const set=done(cur);nd?set.add(it.key):set.delete(it.key);DATA.progress[cur]=[...set];pills();render();
 };
 const cp=el.querySelector('[data-a=copy]');
 if(cp){const lbl=cp.textContent;cp.onclick=()=>navigator.clipboard.writeText(it.prompt).then(()=>{cp.textContent='Copiado!';cp.classList.add('g');setTimeout(()=>{cp.textContent=lbl;cp.classList.remove('g');},1100);});}
 const cg=el.querySelector('[data-a=copyg]');
 if(cg)cg.onclick=()=>navigator.clipboard.writeText(it.prompt_gemini).then(()=>{cg.textContent='Copiado!';cg.classList.add('g');setTimeout(()=>{cg.textContent='Copiar (Gemini)';cg.classList.remove('g');},1100);});
 const cc=el.querySelector('[data-a=ccur]');
 if(cc)cc.onclick=()=>navigator.clipboard.writeText(it.cur).then(()=>{cc.textContent='Copiado!';setTimeout(()=>cc.textContent='Copiar curiosidade',1000);});
 el.querySelector('[data-a=up]').onclick=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=async()=>{
   const fd=new FormData();fd.append('sec',cur);fd.append('key',it.key);fd.append('file',inp.files[0]);
   toast('enviando...');
   const r=await fetch('/api/upload',{method:'POST',body:fd}).then(x=>x.json());
   if(r.ok){
    (DATA.images[cur]=DATA.images[cur]||{})[it.key]=r.url;
    const s=new Set(DATA.progress[cur]||[]);s.add(it.key);DATA.progress[cur]=[...s];
    toast('imagem salva e marcada como pronta');pills();render();
   } else toast(r.erro||'erro');
  };inp.click();
 };
 const rm=el.querySelector('[data-a=rm]');
 if(rm)rm.onclick=async()=>{
  if(!confirm('remover a imagem?'))return;
  await fetch('/api/upload',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({sec:cur,key:it.key})});
  delete DATA.images[cur][it.key];render();
 };
 const cm=el.querySelector('[data-a=commons]');
 if(cm)cm.onclick=async()=>{
  const box=el.querySelector('[data-role=commons]');
  box.classList.remove('hidden');
  box.innerHTML='<span class="cg-msg">buscando no Wikimedia Commons...</span>';
  const r=await fetch('/api/commons_search?q='+encodeURIComponent(it.busca)).then(x=>x.json()).catch(()=>null);
  if(!r||!r.ok||!r.results||!r.results.length){box.innerHTML='<span class="cg-msg">nada encontrado -- tenta "Buscar manualmente".</span>';return;}
  box.innerHTML=r.results.map((c,i)=>`<button class="cg-item" data-i="${i}" title="${(c.title||'').replace(/"/g,'&quot;')}"><img src="${c.thumb}" loading="lazy"></button>`).join('')
   +'<span class="cg-msg">clique na foto certa pra baixar em alta -- confere se é mesmo a moeda/nota antes</span>';
  box.querySelectorAll('.cg-item').forEach(btn=>{
   const c=r.results[+btn.dataset.i];
   btn.onclick=async()=>{
    if(!confirm('Baixar esta imagem como a figurinha de "'+it.titulo+'"?\\n\\n'+c.title))return;
    toast('baixando...');
    const rf=await fetch('/api/commons_fetch',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({sec:cur,key:it.key,url:c.url})}).then(x=>x.json()).catch(()=>null);
    if(rf&&rf.ok){
     (DATA.images[cur]=DATA.images[cur]||{})[it.key]=rf.url;
     const s=new Set(DATA.progress[cur]||[]);s.add(it.key);DATA.progress[cur]=[...s];
     toast('imagem salva e marcada como pronta');pills();render();
    } else toast((rf&&rf.erro)||'erro ao baixar');
   };
  });
 };
}
$('#q').oninput=e=>{q=e.target.value.trim().toLowerCase();render();};
$('#hd').onchange=e=>{hideDone=e.target.checked;render();};
(async()=>{const d=await api('/api/data');DATA={secoes:d.secoes,progress:d.progress,images:d.images};ORDER=d.ordem;cur=ORDER[0];pills();render();})();
</script></body></html>"""


if __name__ == "__main__":
    n_it = sum(len(s["itens"]) for s in ITEMS.values())
    print("Prompts Studio  ->  http://localhost:5002   (%d figurinhas em %d seções)" % (n_it, len(ITEMS)), flush=True)
    app.run(host="127.0.0.1", port=5002, threaded=True, debug=False)
