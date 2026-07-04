from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from html import escape
from io import BytesIO
import csv
import zipfile


BRAND = "Sistema EPPs Monitor"
SUBTITLE = "Detección Inteligente de Equipos de Protección Personal"


def format_datetime(value: datetime | str | None) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime("%d/%m/%Y %H:%M")


def csv_bytes(rows: list[list[object]]) -> bytes:
    import io

    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8-sig")


def _pdf_text(value: object) -> str:
    return str(value if value is not None else "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_stream_text(value: object) -> str:
    return _pdf_text(value).encode("latin-1", "replace").decode("latin-1")


@dataclass
class PdfPage:
    commands: list[str]


class SimplePdf:
    def __init__(self, title: str, user: str):
        self.title = title
        self.user = user
        self.pages: list[PdfPage] = [PdfPage([])]
        self.width = 595
        self.height = 842
        self.margin = 36
        self.y = 790

    @property
    def commands(self) -> list[str]:
        return self.pages[-1].commands

    def new_page(self) -> None:
        self.pages.append(PdfPage([]))
        self.y = 790
        self.header()

    def ensure_space(self, amount: int) -> None:
        if self.y - amount < 70:
            self.footer()
            self.new_page()

    def rect(self, x: int, y: int, w: int, h: int, color: str = "0.95 0.96 0.98", stroke: str | None = "0.85 0.88 0.92") -> None:
        if color:
            self.commands.append(f"{color} rg {x} {y} {w} {h} re f")
        if stroke:
            self.commands.append(f"{stroke} RG {x} {y} {w} {h} re S")

    def text(self, x: int, y: int, text: object, size: int = 10, color: str = "0.08 0.12 0.18", bold: bool = False) -> None:
        font = "/F2" if bold else "/F1"
        self.commands.append(f"BT {color} rg {font} {size} Tf {x} {y} Td ({_pdf_stream_text(text)}) Tj ET")

    def line(self, x1: int, y1: int, x2: int, y2: int, color: str = "0.82 0.86 0.91", width: float = 0.8) -> None:
        self.commands.append(f"{color} RG {width} w {x1} {y1} m {x2} {y2} l S")

    def header(self) -> None:
        self.rect(30, 730, 535, 78, "0.02 0.07 0.12", None)
        self.rect(30, 730, 535, 4, "0.10 0.38 0.66", None)
        self.text(55, 780, BRAND.upper(), 18, "1 1 1", True)
        self.text(55, 760, SUBTITLE, 9, "0.90 0.94 0.98")
        self.text(380, 780, f"Fecha: {format_datetime(datetime.now(UTC))}", 8, "1 1 1")
        self.text(380, 764, f"Usuario: {self.user}", 8, "1 1 1")
        self.text(55, 710, self.title.upper(), 14, "0.05 0.12 0.22", True)
        self.y = 690

    def footer(self) -> None:
        page = len(self.pages)
        self.rect(30, 25, 535, 36, "0.02 0.07 0.12", None)
        self.text(45, 44, BRAND, 8, "1 1 1", True)
        self.text(45, 34, f"Usuario: {self.user} | Fecha: {format_datetime(datetime.now(UTC))}", 7, "0.80 0.88 0.96")
        self.text(470, 42, f"Página {page}", 8, "1 1 1")

    def kpis(self, items: list[tuple[str, str, str]]) -> None:
        self.ensure_space(86)
        card_w = 124
        for index, (label, value, note) in enumerate(items[:4]):
            x = 36 + index * 134
            self.rect(x, self.y - 58, card_w, 58, "0.03 0.10 0.18", None)
            self.text(x + 10, self.y - 22, value, 18, "1 1 1", True)
            self.text(x + 10, self.y - 38, label.upper(), 7, "0.45 0.72 1", True)
            self.text(x + 10, self.y - 51, note, 7, "1 1 1")
        self.y -= 82

    def conclusions(self, lines: list[str]) -> None:
        self.ensure_space(70)
        self.text(42, self.y, "RESUMEN EJECUTIVO", 10, "0.05 0.12 0.22", True)
        self.y -= 18
        for line in lines[:5]:
            self.ensure_space(16)
            self.text(52, self.y, f"- {line.replace('?', '')}", 8, "0.10 0.14 0.20")
            self.y -= 14

    def table(self, title: str, headers: list[str], rows: list[list[object]], widths: list[int], max_rows: int | None = None) -> None:
        rows = rows[:max_rows] if max_rows else rows
        self.ensure_space(48)
        self.text(38, self.y, title.upper(), 10, "0.05 0.12 0.22", True)
        self.y -= 18
        row_h = 18
        x0 = 38
        self.rect(x0, self.y - row_h + 4, sum(widths), row_h, "0.05 0.20 0.38", None)
        x = x0 + 4
        for header, width in zip(headers, widths):
            self.text(x, self.y - 8, header, 7, "1 1 1", True)
            x += width
        self.y -= row_h
        for row_index, row in enumerate(rows):
            self.ensure_space(row_h + 4)
            fill = "0.98 0.99 1" if row_index % 2 == 0 else "0.94 0.96 0.98"
            self.rect(x0, self.y - row_h + 4, sum(widths), row_h, fill, "0.84 0.87 0.91")
            x = x0 + 4
            for value, width in zip(row, widths):
                text = str(value)
                if len(text) > max(8, width // 4):
                    text = text[: max(8, width // 4) - 1] + "…"
                self.text(x, self.y - 8, text, 7, "0.08 0.12 0.18")
                x += width
            self.y -= row_h
        self.y -= 12

    def build(self) -> bytes:
        self.footer()
        objects: list[bytes] = []
        catalog_id = 1
        pages_id = 2
        font_regular_id = 3
        font_bold_id = 4
        next_id = 5
        page_ids: list[int] = []
        content_ids: list[int] = []
        for page in self.pages:
            content_id = next_id
            page_id = next_id + 1
            next_id += 2
            content_ids.append(content_id)
            page_ids.append(page_id)
            stream = "\n".join(page.commands).encode("latin-1", "replace")
            objects.append(f"{content_id} 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream\nendobj\n")
            objects.append(
                f"{page_id} 0 obj\n<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {self.width} {self.height}] "
                f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> /Contents {content_id} 0 R >>\nendobj\n".encode()
            )
        page_refs = " ".join(f"{page_id} 0 R" for page_id in page_ids)
        fixed_objects = [
            f"{catalog_id} 0 obj\n<< /Type /Catalog /Pages {pages_id} 0 R >>\nendobj\n".encode(),
            f"{pages_id} 0 obj\n<< /Type /Pages /Kids [{page_refs}] /Count {len(page_ids)} >>\nendobj\n".encode(),
            f"{font_regular_id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n".encode(),
            f"{font_bold_id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n".encode(),
        ]
        all_objects = fixed_objects + objects
        output = BytesIO()
        output.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for obj in all_objects:
            offsets.append(output.tell())
            output.write(obj)
        xref = output.tell()
        output.write(f"xref\n0 {len(all_objects) + 1}\n0000000000 65535 f \n".encode())
        for offset in offsets[1:]:
            output.write(f"{offset:010d} 00000 n \n".encode())
        output.write(f"trailer\n<< /Size {len(all_objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
        return output.getvalue()


def build_report_pdf(summary: dict, user: str, report_range: str) -> bytes:
    pdf = SimplePdf("Reporte general de seguridad", user)
    pdf.header()
    stats = [(item["label"], item["value"], "Indicador ejecutivo") for item in summary["stats"]]
    pdf.kpis(stats)
    pdf.table("Infracciones por día", ["Día", "Infracciones"], [[i["day"], i["violations"]] for i in summary["violations_by_day"]], [180, 120], 20)
    pdf.table("Infracciones por tipo de EPP", ["EPP", "Total"], [[i["name"], i["value"]] for i in summary["violations_by_epp"]], [180, 120])
    pdf.table("Cumplimiento por zona", ["Zona", "Cumplimiento"], [[i["area"], f'{i["compliance"]}%'] for i in summary["compliance_by_area"]], [220, 120])
    pdf.table("Tabla resumen", ["Métrica", "Valor", "Rango"], [[i["label"], i["value"], report_range] for i in summary["stats"]], [220, 100, 100])
    pdf.conclusions(report_conclusions(summary))
    return pdf.build()


def build_detections_pdf(items: list[dict], user: str, title: str = "Detalle de infracciones") -> bytes:
    pdf = SimplePdf(title, user)
    pdf.header()
    pdf.kpis([
        ("Registros", str(len(items)), "Filtrados"),
        ("Cámaras", str(len({item.get("camera_code") or item.get("camera_id") for item in items})), "Con eventos"),
        ("EPP faltantes", str(sum(len(item.get("missing_epps", [])) for item in items)), "Total"),
        ("Severidad alta", str(sum(1 for item in items if item.get("severity") == "high")), "Eventos"),
    ])
    rows = [
        [
            item.get("id", "")[-8:],
            item.get("camera_code") or item.get("camera_id") or "",
            item.get("area_name") or item.get("location") or "",
            format_datetime(item.get("created_at") or item.get("timestamp")),
            ", ".join(item.get("missing_epps", [])),
            item.get("severity", ""),
            item.get("status", "Nueva"),
        ]
        for item in items
    ]
    pdf.table("Detalle de infracciones", ["ID", "Cámara", "Ubicación", "Fecha/Hora", "EPP", "Sev.", "Estado"], rows, [54, 60, 108, 86, 100, 42, 54], 1000)
    pdf.conclusions(detection_conclusions(items))
    return pdf.build()


def _int_value(value: object) -> int:
    try:
        return int(str(value).replace("%", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return 0


def _plural(count: int, singular: str, plural: str) -> str:
    return singular if count == 1 else plural


def report_conclusions(summary: dict) -> list[str]:
    stats = {item["label"]: item["value"] for item in summary.get("stats", [])}
    epp_items = summary.get("violations_by_epp", [])
    area_items = summary.get("compliance_by_area", [])
    day_items = summary.get("violations_by_day", [])
    total_violations = _int_value(stats.get("Infracciones Detectadas", 0))
    total_cameras = _int_value(stats.get("Zonas Monitoreadas", 0))
    top_epp = max(epp_items, key=lambda item: item.get("value", 0), default=None)
    low_area = min(area_items, key=lambda item: item.get("compliance", 100), default=None)
    active_days = sum(1 for item in day_items if item.get("violations", 0) > 0)
    conclusions = [
        f"Se {_plural(total_violations, 'registró', 'registraron')} {total_violations} {_plural(total_violations, 'infracción', 'infracciones')} durante el período analizado.",
        f"El monitoreo consideró {total_cameras} {_plural(total_cameras, 'cámara registrada', 'cámaras registradas')} en el sistema.",
    ]
    if top_epp:
        value = _int_value(top_epp.get("value", 0))
        conclusions.append(f"El EPP con mayor incumplimiento fue {top_epp['name']} con {value} {_plural(value, 'ocurrencia', 'ocurrencias')}.")
    if low_area:
        conclusions.append(f"El área con menor nivel de cumplimiento fue {low_area['area']} con {low_area['compliance']}%.")
    conclusions.append(f"Se observó actividad de infracciones en {active_days} {_plural(active_days, 'día', 'días')} del período.")
    conclusions.append("Se recomienda reforzar la supervisión en las áreas con mayor incidencia.")
    return conclusions


def detection_conclusions(items: list[dict]) -> list[str]:
    high = sum(1 for item in items if item.get("severity") == "high")
    cameras = len({item.get("camera_code") or item.get("camera_id") for item in items if item.get("camera_code") or item.get("camera_id")})
    epp_counts: dict[str, int] = {}
    for item in items:
        for epp in item.get("missing_epps", []):
            epp_counts[epp] = epp_counts.get(epp, 0) + 1
    top_epp = max(epp_counts.items(), key=lambda item: item[1], default=None)
    total = len(items)
    conclusions = [
        f"Se {_plural(total, 'registró', 'registraron')} {total} {_plural(total, 'infracción', 'infracciones')} con los filtros aplicados.",
        f"Las infracciones fueron detectadas por {cameras} {_plural(cameras, 'cámara', 'cámaras')}.",
        f"Se {_plural(high, 'identificó', 'identificaron')} {high} {_plural(high, 'evento', 'eventos')} de severidad Alta.",
    ]
    if top_epp:
        conclusions.append(f"El EPP con mayor incumplimiento fue {top_epp[0]} con {top_epp[1]} {_plural(top_epp[1], 'ocurrencia', 'ocurrencias')}.")
    conclusions.append("Se recomienda reforzar la supervisión en las áreas con mayor incidencia.")
    return conclusions


def _content_types() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""


def _styles() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B1F35"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""


def _cell(value: object, style: int = 0) -> str:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c s="{style}"><v>{value}</v></c>'
    return f'<c s="{style}" t="inlineStr"><is><t>{escape(str(value if value is not None else ""))}</t></is></c>'


def _row(values: list[object], style: int = 0) -> str:
    return "<row>" + "".join(_cell(value, style) for value in values) + "</row>"


def _column_widths(rows: list[list[object]]) -> str:
    max_cols = max((len(row) for row in rows), default=1)
    cols = []
    for index in range(max_cols):
        width = min(42, max(12, max((len(str(row[index])) if index < len(row) else 0 for row in rows), default=0) + 2))
        cols.append(f'<col min="{index + 1}" max="{index + 1}" width="{width}" customWidth="1"/>')
    return "".join(cols)


def _sheet(rows: list[list[object]], title_rows: int = 1) -> str:
    xml_rows = []
    for index, row in enumerate(rows):
        style = 1 if index < title_rows else 2 if index == title_rows else 0
        xml_rows.append(_row(row, style))
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="{title_rows + 1}" topLeftCell="A{title_rows + 2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>{_column_widths(rows)}</cols>
<sheetData>{''.join(xml_rows)}</sheetData>
</worksheet>"""


def build_xlsx(sheets: list[tuple[str, list[list[object]], int]]) -> bytes:
    workbook_sheets = "".join(f'<sheet name="{escape(name)}" sheetId="{idx}" r:id="rId{idx}"/>' for idx, (name, _, _) in enumerate(sheets, start=1))
    workbook_rels = "".join(f'<Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>' for idx in range(1, len(sheets) + 1))
    workbook_rels += '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _content_types())
        zf.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""")
        zf.writestr("xl/workbook.xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>{workbook_sheets}</sheets></workbook>""")
        zf.writestr("xl/_rels/workbook.xml.rels", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{workbook_rels}</Relationships>""")
        zf.writestr("xl/styles.xml", _styles())
        for idx, (_, rows, title_rows) in enumerate(sheets, start=1):
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", _sheet(rows, title_rows))
    return buffer.getvalue()


def build_report_xlsx(summary: dict, user: str, report_range: str) -> bytes:
    generated = format_datetime(datetime.now(UTC))
    resumen = [
        [BRAND, "", "", generated],
        [SUBTITLE, "", "Usuario", user],
        ["Rango aplicado", report_range],
        [],
        ["Resumen Ejecutivo"],
        ["Indicador", "Valor"],
        *[[item["label"], item["value"]] for item in summary["stats"]],
        [],
        ["Conclusiones"],
        *[[line] for line in report_conclusions(summary)],
    ]
    datos = [
        ["Sección", "Etiqueta", "Valor"],
        *[["Infracciones por día", item["day"], item["violations"]] for item in summary["violations_by_day"]],
        *[["Infracciones por EPP", item["name"], item["value"]] for item in summary["violations_by_epp"]],
        *[["Cumplimiento por zona", item["area"], f'{item["compliance"]}%'] for item in summary["compliance_by_area"]],
    ]
    dashboard = [
        ["Dashboard Ejecutivo", "", "", generated],
        ["Usuario", user, "Rango", report_range],
        [],
        ["KPIs"],
        ["Métrica", "Valor"],
        *[[item["label"], item["value"]] for item in summary["stats"]],
        [],
        ["Infracciones por día"],
        ["Día", "Total"],
        *[[item["day"], item["violations"]] for item in summary["violations_by_day"][-15:]],
        [],
        ["Infracciones por tipo de EPP"],
        ["EPP", "Total"],
        *[[item["name"], item["value"]] for item in summary["violations_by_epp"]],
        [],
        ["Cumplimiento por zona"],
        ["Zona", "Cumplimiento"],
        *[[item["area"], f'{item["compliance"]}%'] for item in summary["compliance_by_area"]],
    ]
    return build_xlsx([("Resumen Ejecutivo", resumen, 4), ("Datos", datos, 0), ("Dashboard", dashboard, 0)])


def build_detections_xlsx(items: list[dict], user: str) -> bytes:
    generated = format_datetime(datetime.now(UTC))
    headers = ["ID", "Cámara", "Ubicación", "Fecha/Hora", "EPP faltantes", "Severidad", "Estado"]
    data_rows = [
        [
            item.get("id", ""),
            item.get("camera_code") or item.get("camera_id") or "",
            item.get("area_name") or item.get("location") or "",
            format_datetime(item.get("created_at") or item.get("timestamp")),
            ", ".join(item.get("missing_epps", [])),
            item.get("severity", ""),
            item.get("status", "Nueva"),
        ]
        for item in items
    ]
    resumen = [
        [BRAND, "", "", generated],
        [SUBTITLE, "", "Usuario", user],
        ["Total registros", len(items)],
        ["Cámaras", len({row[1] for row in data_rows})],
        ["EPP faltantes", sum(len(item.get("missing_epps", [])) for item in items)],
        [],
        ["Conclusiones"],
        *[[line] for line in detection_conclusions(items)],
    ]
    severity_rows = [
        ["Alta", sum(1 for item in items if item.get("severity") == "high")],
        ["Media", sum(1 for item in items if item.get("severity") == "medium")],
        ["Baja", sum(1 for item in items if item.get("severity") == "low")],
    ]
    dashboard = [
        ["Dashboard Ejecutivo", "", "", generated],
        ["Usuario", user],
        [],
        ["Indicador", "Valor"],
        ["Registros", len(items)],
        ["Cámaras", len({row[1] for row in data_rows})],
        ["EPP faltantes", sum(len(item.get("missing_epps", [])) for item in items)],
        [],
        ["Severidad"],
        ["Tipo", "Total"],
        *severity_rows,
    ]
    return build_xlsx([("Resumen Ejecutivo", resumen, 2), ("Datos", [headers, *data_rows], 0), ("Dashboard", dashboard, 0)])
