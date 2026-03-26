/**
 * Script de seed one-time para poblar el directorio con los proveedores
 * del módulo de devoluciones. Ejecutar desde consola del navegador:
 *
 *   import { seedProveedores } from './pages/operations/directorio/seed-proveedores';
 *   seedProveedores();
 *
 * O usar el botón temporal en DirectoryTab.
 */
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const PROVEEDORES_EMAIL: Record<string, string[]> = {
  "Penguin RandomHouse (MED)": ["natalia.Hurtado@penguinrandomhouse.com", "cedi@bukz.co"],
  "Penguin RandomHouse (BOG)": ["fernanda.Herrera@penguinrandomhouse.com", "cedi@bukz.co"],
  "Grupo Editorial Planeta (MED)": ["mromero@planeta.com.co", "cedi@bukz.co"],
  "Grupo Editorial Planeta (BOG)": ["ovargas@planeta.com.co", "cedi@bukz.co"],
  "Oceano": ["alejandro.vargas@oceano.com.co", "cedi@bukz.co"],
  "Grupo Penta": ["zoraida.ojeda@grupopenta.com.co", "cedi@bukz.co"],
  "Siglo del Hombre (MED)": ["hjimenez@siglodelhombre.com", "cedi@bukz.co"],
  "Siglo del Hombre (BOG)": ["jbernal@somossiglo.com", "cedi@bukz.co"],
  "Grupo Monserrate": ["grupomonserratemedellin@hotmail.com", "artbooksmilenaleonel@gmail.com", "cedi@bukz.co"],
  "Sin Fronteras": ["comercial1@gruposinfronteras.com", "cedi@bukz.co"],
  "ACLI": ["info.aclilibreros@gmail.com", "inventariosacli@gmail.com", "cedi@bukz.co"],
  "Alianza Editorial": ["alianzaeditorialmed@hotmail.com", "cedi@bukz.co"],
  "Alicia Mejia": ["administrativo@thinklicious.com", "cedi@bukz.co"],
  "Angosta Editores": ["auxiliar@angosta.co", "cedi@bukz.co"],
  "Arquine": ["camilo@agendarq.com", "andrea@arquine.com", "miquel@arquine.com", "distribucion@arquine.com"],
  "Artemis Libros": ["artemislibros@yahoo.es", "cedi@bukz.co"],
  "Caballito de Acero": ["editorial@caballitodeacero.com", "cedi@bukz.co"],
  "Calixta Editores": ["luis.izquierdo@calixtaeditores.com", "cedi@bukz.co"],
  "Carolina Giraldo García": ["hola@carogiraldogarcia.com", "cedi@bukz.co"],
  "Carolina Pérez Botero": ["carolina@amorescaprichosos.com", "cedi@bukz.co"],
  "Catalina Mayorga": ["gonzalez.saldarriaga@gmail.com", "cedi@bukz.co"],
  "Circulo de lectores": ["aremil@circulo.com.co", "cedi@bukz.co"],
  "Contenido": ["contenido.contenido@gmail.com", "cedi@bukz.co"],
  "Cubo Universo Creativo": ["gerencia@cubocultural.com", "cedi@bukz.co"],
  "Difusora Larousse de Colombia": ["francygonzalez@larousse.co", "cedi@bukz.co"],
  "Diseños Lalys": ["leamosliteraturayletras@gmail.com", "cedi@bukz.co"],
  "Ediciones Gaviota": ["ventas1@ediciones-gaviota.com", "cedi@bukz.co"],
  "Ediciones Urano (MED)": ["m.osorio@edicionesurano.com", "cedi@bukz.co"],
  "Ediciones Urano (BOG)": ["f.arevalo@uranoworld.com", "cedi@bukz.co"],
  "Ediciones Vestigio": ["editor.vestigio@gmail.com", "cedi@bukz.co"],
  "Editorial Eafit": ["aherrerag@eafit.edu.co", "cedi@bukz.co"],
  "Editorial Quimbombó": ["editorialquimbombo@gmail.com", "cedi@bukz.co"],
  "Editorial Solar": ["nathalie.editorialsolar@gmail.com", "cedi@bukz.co"],
  "Elev8 Media S.A.S": ["gary@elev8.io", "elizabeth@elev8.io", "giraldo.anamaria@asesoriashg.com", "cedi@bukz.co"],
  "Epifánico": ["contacto@epifanico.com", "cedi@bukz.co"],
  "Estrategia en Ventas": ["soporte@estrategiaenventas.co", "cedi@bukz.co"],
  "FCE": ["camilo.hernandez@fce.com.co", "cedi@bukz.co"],
  "Fondo Cultural Iberoamericano (MED)": ["focui@outlook.com", "cedi@bukz.co"],
  "Fondo Cultural Iberoamericano (BOG)": ["vivianateresaluna15@gmail.com", "cedi@bukz.co"],
  "Frailejón Editores": ["frailejoneditores@gmail.com", "cedi@bukz.co"],
  "Huracán Distribución": ["huracandistribucion@gmail.com", "cedi@bukz.co"],
  "Icaro Libros": ["ventas@icarolibros.com"],
  "La Editora - Ana Meza": ["ana@analaeditora.com", "cedi@bukz.co"],
  "Libro Arte S.A.S": ["Ventas@tarangoplay.com", "cedi@bukz.co"],
  "Lobolunar": ["lobolunarcolombia@gmail.com", "cedi@bukz.co"],
  "Mandalas para el alma": ["direccion@andreagudelo.com", "cedi@bukz.co"],
  "Marco Polo": ["marcopolo.encuadernacion.art@gmail.com", "cedi@bukz.co"],
  "Mesaestandar": ["contacto@mesaestandar.com", "cedi@bukz.co"],
  "No Apto": ["marianavasquez90@hotmail.com", "cedi@bukz.co"],
  "Plaza & Janes": ["diego.ospina@plazayjanescolombia.com", "cedi@bukz.co"],
  "Poster Colombia": ["postercolombia@gmail.com", "cedi@bukz.co"],
  "Raya Editores": ["rayaeditorial@gmail.com", "cedi@bukz.co"],
  "Rey Naranjo": ["administrativo@reynaranjo.net", "cedi@bukz.co"],
  "Silaba Editores": ["asistentesilaba@gmail.com", "cedi@bukz.co"],
  "SITRA Mundo Creativo": ["basalmobiliario@gmail.com", "cedi@bukz.co"],
  "Taller de edición Rocca": ["correotallerdeedicionrocca@gmail.com", "cedi@bukz.co"],
  "Ingenio": ["comercial@ingeniodestrezamental.com", "pperez@ingeniodestrezamental.com", "cedi@bukz.co"],
  "Tool-be": ["alejandra.zuluaga@tool-be.com", "maria.velez@tool-be.com", "cedi@bukz.co"],
  "Tragaluz Editores": ["ventas@tragaluzeditores.com", "cedi@bukz.co"],
  "Travesía Juglar": ["travesiajuglar@gmail.com", "cedi@bukz.co"],
  "Universidad CES": ["ndurangor@ces.edu.co", "cedi@bukz.co"],
  "Vasquez Editores": ["vasquezeditores@gmail.com", "cedi@bukz.co"],
  "Viiel": ["solarber2010@gmail.com", "cedi@bukz.co"],
  "Policefalo": ["policefaloediciones@gmail.com", "cedi@bukz.co"],
  "Asociación de Editoriales Independientes de Chile": ["andresfberdugo@gmail.com", "cedi@bukz.co"],
  "La Valija de Fuego Editorial": ["lavalijadefuegoeditorial@gmail.com", "cedi@bukz.co"],
  "Arbitraria": ["arbitrariaeditorial@gmail.com", "cedi@bukz.co"],
  "Libros del Motín": ["david7g@gmail.com", "cedi@bukz.co"],
  "Lazo Libros": ["hola@lazolibros.com", "cedi@bukz.co"],
  "Axioma Editores": ["axiomaeditores@gmail.com", "cedi@bukz.co"],
  "Grammata - Vazquez": ["vasquezeditores@gmail.com", "cedi@bukz.co"],
  "Saga Libros": ["ventas@saga.com.co", "cedi@bukz.co"],
  "Mo Ediciones": ["monica.montes@moediciones.com", "cedi@bukz.co"],
  "Cain Press": ["info@cainpress.com", "cedi@bukz.co"],
  "Libros del Fuego": ["rodcasares@gmail.com", "cedi@bukz.co"],
  "Verso Libre": ["versolibre@comunycorriente.org", "cedi@bukz.co"],
  "Artimaña Editorial": ["artimanaeditorial@gmail.com", "cedi@bukz.co"],
  "McMullan Birding": ["ensiferaeditores@gmail.com", "cedi@bukz.co"],
  "Club Editores S.A.": ["dianapaezm@yahoo.com", "cedi@bukz.co"],
  "As Ediciones": ["gerencia@asediciones.com", "cedi@bukz.co"],
  "Amelia Amortegui": ["holavengaledigo@gmail.com", "cedi@bukz.co"],
  "Dos Gatos Editores": ["xtinawilhelm@gmail.com", "cedi@bukz.co"],
  "Cypres": ["cypreslibrerias@gmail.com", "cedi@bukz.co"],
  "Kocodio": ["info@kocodio.com", "comercial@kocodio.com", "cedi@bukz.co"],
  "Astropuerta": ["astropuerta@gmail.com", "cedi@bukz.co"],
  "Ediciones el Silencio": ["logisticaedicioneselsilencio@gmail.com", "auxiliardeventas@edicioneselsilencio.com.co", "cedi@bukz.co"],
  "Ediciones de la U": ["comercial1@edicionesdelau.com", "cedi@bukz.co"],
  "Fera": ["ventas.fera@gmail.com", "cedi@bukz.co"],
  "Poiema Publicaciones": ["celis@poiema.co", "cedi@bukz.co"],
  "Ediciones Gamma": ["comercial@revistadiners.com.co", "cedi@bukz.co"],
  "Union Editorial Colombia": ["gilberto.ramirez@unioneditorial.net", "freddyjosecarrillo@gmail.com", "cedi@bukz.co"],
  "Lavanda Editoras": ["claudiaivonne09@gmail.com", "cedi@bukz.co"],
  "Germán Puerta": ["astropuerta@gmail.com", "cedi@bukz.co"],
  "Villegas Editores": ["comercial@villegaseditores.com", "cedi@bukz.co"],
  "La Diligencia": ["ladiligenciacolombia@gmail.com", "cedi@bukz.co"],
  "Babel": ["libros.babel@gmail.com", "cedi@bukz.co"],
  "Luz Karime Saleme Correa": ["lksaleme@leonardonino.com", "cedi@bukz.co"],
  "Cangrejo Editores": ["camilo.aljure@cangrejoeditores.com", "cedi@bukz.co"],
  "Testigo Directo": ["produccion@testigodirectoeditorial.com", "cedi@bukz.co"],
  "Panamericana": ["panamericanaeditorial.pedidos@panamericana.com.co", "adriana.tovar@panamericana.com.co", "cedi@bukz.co"],
  "Hipertexto": ["lider.supplychain@hipertexto.com.co", "cedi@bukz.co"],
  "Unilat": ["ventas@unilat.com.co", "cedi@bukz.co"],
  "Ojos de tus Ojos": ["carojimet@gmail.com", "cedi@bukz.co"],
  "Secretos para Contar": ["yeny.castrillon@secretosparacontar.org", "cedi@bukz.co"],
  "SOFIA EDITORES SAS": ["sofiaeditores@gmail.com", "moniquillar@gmail.com", "cedi@bukz.co"],
  "Proyectos Sin Limites": ["ventas@proyectossinlimites.com", "cedi@bukz.co"],
  "Catherine Villota": ["catyvillota@fashionradicals.com", "cedi@bukz.co"],
  "Jaime Botero": ["lasagabotero@gmail.com", "cedi@bukz.co"],
  "Empoderados SAS": ["diana@antu.com.co", "cedi@bukz.co"],
  "The Black Bean": ["hola@theblackbean.net", "cedi@bukz.co"],
  "Harry Marin": ["marinvahos@hotmail.com", "cedi@bukz.co"],
  "Holz Haus": ["xilostech@gmail.com", "cechavarriasoto@gmail.com", "cedi@bukz.co"],
  "Ediciones La Pluma del Águila": ["jarredondo@aguiladescalza.com.co", "cedi@bukz.co"],
  "Maria Pulido Alvarez": ["laura.alvarezlopez83@gmail.com", "cedi@bukz.co"],
  "Nelly Giraldo Gil": ["wonderwiseeod@gmail.com", "cedi@bukz.co"],
  "Fundación Casa Arcoíris": ["casaarcoiris7@gmail.com", "cedi@bukz.co"],
  "Valeria Marín Pineda": ["gatosmaestrosdevida@gmail.com", "cedi@bukz.co"],
  "Aguila Descalza": ["contabilidad@aguiladescalza.com.co", "asisadministrativo@aguiladescalza.com.co", "cedi@bukz.co"],
  "Acuarell": ["zalamt@hotmail.com", "cedi@bukz.co"],
  "Happy Kiddo": ["lorena@happykiddobooks.com", "cedi@bukz.co"],
  "Feliciano Escobar": ["felicianoescobar@yahoo.com", "medellinupclose@gmail.com", "cedi@bukz.co"],
  "Booktique": ["booktiquecol@gmail.com", "medellinupclose@gmail.com", "cedi@bukz.co"],
  "Idealo Pez": ["lestrada@idealopez.com", "cedi@bukz.co"],
  "Alejandro Salazar": ["administrativa@tbreakthrough.com", "cedi@bukz.co"],
  "Toy": ["comercial@toystyle.co", "cedi@bukz.co"],
  "Sin Ocasión": ["sinocasion@outlook.com", "cedi@bukz.co"],
  "Arpegio Cool": ["arpegio.cool@gmail.com", "cedi@bukz.co"],
  "Norma": ["imontoya@edicionesnorma.com", "cedi@bukz.co"],
};

function extractEmails(emails: string[]): string {
  const filtered = emails.filter((e) => e !== "cedi@bukz.co");
  return filtered.length > 0 ? filtered.join(", ") : emails.join(", ");
}

export async function seedProveedores(createdBy = "operaciones@bukz.co") {
  const colRef = collection(db, "directory");
  let count = 0;
  const total = Object.keys(PROVEEDORES_EMAIL).length;

  console.log(`Seeding ${total} proveedores...`);

  for (const [empresa, emails] of Object.entries(PROVEEDORES_EMAIL)) {
    const correo = extractEmails(emails);
    await addDoc(colRef, {
      type: "proveedor",
      empresa,
      razonSocial: "",
      nit: "",
      margen: 0,
      correo,
      estado: "Activo",
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
    if (count % 20 === 0) {
      console.log(`  ${count}/${total} insertados...`);
    }
  }

  console.log(`Seed completo: ${count} proveedores insertados.`);
  return count;
}
