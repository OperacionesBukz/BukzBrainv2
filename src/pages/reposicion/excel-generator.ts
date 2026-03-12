import JSZip from "jszip";
import type { ProductAnalysis, ReplenishmentResult, ReplenishmentStats } from "./types";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateOrderExcelXML(items: ProductAnalysis[], vendor: string, sede: string, fecha: string): string {
  const sorted = [...items].sort((a, b) => {
    const ord: Record<string, number> = { URGENTE: 0, PRONTO: 1, NORMAL: 2, OK: 3 };
    return (ord[a.urgency] ?? 4) - (ord[b.urgency] ?? 4);
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Arial" ss:Size="11"/><Interior ss:Color="#2C3E50" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="title"><Font ss:Bold="1" ss:Color="#2C3E50" ss:FontName="Arial" ss:Size="13"/></Style>
 <Style ss:ID="sub"><Font ss:Color="#7F8C8D" ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="norm"><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="center"><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="bold"><Font ss:Bold="1" ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Center"/></Style>
</Styles>
<Worksheet ss:Name="Pedido">
<Table>
 <Column ss:Width="150"/><Column ss:Width="350"/><Column ss:Width="100"/><Column ss:Width="110"/>
 <Row><Cell ss:MergeAcross="3" ss:StyleID="title"><Data ss:Type="String">PEDIDO — ${esc(vendor)}</Data></Cell></Row>
 <Row><Cell ss:MergeAcross="3" ss:StyleID="sub"><Data ss:Type="String">Tienda: ${esc(sede)} | Fecha: ${fecha}</Data></Cell></Row>
 <Row/>
 <Row>
  <Cell ss:StyleID="head"><Data ss:Type="String">ISBN</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Título</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Cantidad</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Stock Actual</Data></Cell>
 </Row>`;

  sorted.forEach((item) => {
    xml += `
 <Row>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(item.sku)}</Data></Cell>
  <Cell ss:StyleID="norm"><Data ss:Type="String">${esc(item.title)}</Data></Cell>
  <Cell ss:StyleID="center"><Data ss:Type="Number">${item.orderQuantity}</Data></Cell>
  <Cell ss:StyleID="center"><Data ss:Type="Number">${item.stock}</Data></Cell>
 </Row>`;
  });

  const totalQty = sorted.reduce((s, i) => s + i.orderQuantity, 0);
  xml += `
 <Row>
  <Cell ss:StyleID="bold"><Data ss:Type="String">TOTAL</Data></Cell><Cell ss:StyleID="norm"/>
  <Cell ss:StyleID="bold"><Data ss:Type="Number">${totalQty}</Data></Cell><Cell/>
 </Row>
</Table></Worksheet></Workbook>`;
  return xml;
}

function generateAnalysisExcelXML(
  allResults: ProductAnalysis[],
  sede: string,
  fecha: string,
  stats: ReplenishmentStats
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Arial" ss:Size="11"/><Interior ss:Color="#2C3E50" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="title"><Font ss:Bold="1" ss:Color="#2C3E50" ss:FontName="Arial" ss:Size="14"/></Style>
 <Style ss:ID="sub"><Font ss:Color="#7F8C8D" ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="urgent"><Interior ss:Color="#FADBD8" ss:Pattern="Solid"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="soon"><Interior ss:Color="#FEF9E7" ss:Pattern="Solid"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="normal"><Interior ss:Color="#EAFAF1" ss:Pattern="Solid"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="ok"><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="norm"><Font ss:FontName="Arial" ss:Size="10"/></Style>
 <Style ss:ID="urgcenter"><Interior ss:Color="#FADBD8" ss:Pattern="Solid"/><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="sooncenter"><Interior ss:Color="#FEF9E7" ss:Pattern="Solid"/><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="normalcenter"><Interior ss:Color="#EAFAF1" ss:Pattern="Solid"/><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Center"/></Style>
 <Style ss:ID="okcenter"><Font ss:FontName="Arial" ss:Size="10"/><Alignment ss:Horizontal="Center"/></Style>
</Styles>
<Worksheet ss:Name="Análisis Inventario">
<Table>
 <Column ss:Width="150"/><Column ss:Width="300"/><Column ss:Width="180"/><Column ss:Width="110"/>
 <Column ss:Width="90"/><Column ss:Width="100"/><Column ss:Width="90"/><Column ss:Width="100"/>
 <Column ss:Width="90"/><Column ss:Width="110"/><Column ss:Width="120"/>
 <Row><Cell ss:MergeAcross="10" ss:StyleID="title"><Data ss:Type="String">ANÁLISIS DE INVENTARIO — ${esc(sede)}</Data></Cell></Row>
 <Row><Cell ss:MergeAcross="10" ss:StyleID="sub"><Data ss:Type="String">Fecha: ${fecha} | Productos activos: ${stats.totalProducts} | Necesitan reposición: ${stats.needReplenishment} | Urgentes: ${stats.urgent} | Agotados: ${stats.outOfStock}</Data></Cell></Row>
 <Row/>
 <Row>
  <Cell ss:StyleID="head"><Data ss:Type="String">ISBN</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Título</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Proveedor / Editorial</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Clasificación</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Vta/Mes</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Vta/Semana</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Stock Actual</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Días Inventario</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Urgencia</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Punto Reorden</Data></Cell>
  <Cell ss:StyleID="head"><Data ss:Type="String">Cantidad Sugerida</Data></Cell>
 </Row>`;

  allResults.forEach((r) => {
    const isU = r.urgency === "URGENTE";
    const isS = r.urgency === "PRONTO";
    const isN = r.urgency === "NORMAL";
    const s = isU ? "urgent" : isS ? "soon" : isN ? "normal" : "ok";
    const sc = isU ? "urgcenter" : isS ? "sooncenter" : isN ? "normalcenter" : "okcenter";
    xml += `
 <Row>
  <Cell ss:StyleID="${s}"><Data ss:Type="String">${esc(r.sku)}</Data></Cell>
  <Cell ss:StyleID="${s}"><Data ss:Type="String">${esc(r.title)}</Data></Cell>
  <Cell ss:StyleID="${s}"><Data ss:Type="String">${esc(r.vendor)}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="String">${r.classificationLabel}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="Number">${r.salesPerMonth}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="Number">${r.salesPerWeek}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="Number">${r.stock}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="String">${r.daysOfInventory}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="String">${r.urgencyLabel}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="Number">${r.reorderPoint}</Data></Cell>
  <Cell ss:StyleID="${sc}"><Data ss:Type="Number">${r.orderQuantity}</Data></Cell>
 </Row>`;
  });

  xml += `
</Table></Worksheet></Workbook>`;
  return xml;
}

export async function generateReplenishmentZip(result: ReplenishmentResult, sede: string): Promise<Blob> {
  const zip = new JSZip();
  const fecha = new Date().toLocaleDateString("es-CO");
  const safeSede = sede.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "").trim();

  result.vendors.forEach((v) => {
    const safeVendor = v.vendor.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "").trim();
    zip.file(`Pedido_${safeVendor}.xls`, generateOrderExcelXML(v.items, v.vendor, sede, fecha));
  });

  zip.file(`Analisis_Inventario_${safeSede}.xls`, generateAnalysisExcelXML(result.products, sede, fecha, result.stats));

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
