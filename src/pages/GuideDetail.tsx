import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const guidesMeta: Record<string, { title: string; categories: string[] }> = {
  "creacion-de-productos": { title: "Creación de Productos", categories: ["Operaciones"] },
  "facturacion-pos": { title: "Facturación POS", categories: ["Librerías"] },
  "traslados": { title: "Traslados", categories: ["Operaciones", "Librerías"] },
  "ingresos": { title: "Ingresos", categories: ["Operaciones", "Librerías"] },
  "permisos-y-vacaciones": { title: "Permisos y Vacaciones", categories: ["General"] },
  "pedidos-cancelados-y-devoluciones": { title: "Pedidos Cancelados, Devoluciones y Cambios", categories: ["Operaciones", "Librerías"] },
};

const PermisosContent = () => (
  <>
    <section className="space-y-4">
      <p className="text-muted-foreground text-lg leading-relaxed">
        ¡Hola! En esta guía aprenderás cómo solicitar tus permisos y vacaciones de forma rápida y sencilla a través de nuestra plataforma. Queremos que el proceso sea claro para todos.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">01</span>
        Tipos de Solicitud
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🏖️ Vacaciones</h3>
          <p className="text-sm text-muted-foreground">Tiempo para descansar y recargar energías.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-amber-500/5 dark:bg-amber-500/10">
          <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-1">🎂 Día de Cumpleaños</h3>
          <p className="text-sm text-amber-800/80 dark:text-amber-200/80">¡Tu regalo de la empresa! Un día libre para celebrar.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">💼 Permiso Remunerado</h3>
          <p className="text-sm text-muted-foreground">Citas médicas certificados o situaciones personales justificadas.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🚫 Permiso No Remunerado</h3>
          <p className="text-sm text-muted-foreground">Días libres extras sin pago por motivos personales.</p>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">02</span>
        Pasos para solicitar
      </h2>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">1</div>
          <p className="text-sm text-foreground">Ve al módulo de <strong>"Solicitudes"</strong> en el menú lateral.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">2</div>
          <p className="text-sm text-foreground">Selecciona la solicitud que corresponde a lo que necesitas (ej. la palmera para vacaciones).</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">3</div>
          <p className="text-sm text-foreground">Completa tus datos personales (Nombre, Documento, Cargo, Sede y Jefe Directo).</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">4</div>
          <p className="text-sm text-foreground">Elige las fechas en el calendario y escribe el motivo si es necesario.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">5</div>
          <p className="text-sm text-foreground">Haz clic en <strong>"Enviar Solicitud"</strong>. ¡Y listo!</p>
        </div>
      </div>
    </section>

    <section className="space-y-4 p-6 rounded-2xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/20">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">💡 Información Importante</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-foreground/80">
        <li><strong>Vacaciones:</strong> Solicítalas con al menos <strong>15 días de anticipación</strong>.</li>
        <li><strong>Cierre:</strong> Consulta el <strong>Calendario Institucional 2026</strong> en la parte inferior de "Solicitudes" para ver los días disponibles.</li>
        <li><strong>Notificación:</strong> Tu confirmación será enviada a tu jefe directo y al correo de tu sede.</li>
        <li><strong>Seguimiento:</strong> Una vez enviada, puedes ver el estado (Pendiente, Aprobado o Rechazado) en la pestaña de <strong>Seguimiento</strong> dentro del mismo módulo.</li>
      </ul>
    </section>

    <section className="text-center py-8">
      <p className="text-muted-foreground text-sm italic">
        Tu bienestar es importante para nosotros. Si tienes dudas, consulta con tu jefe inmediato.
      </p>
    </section>
  </>
);

const TrasladosContent = () => (
  <>
    <section className="space-y-4">
      <p className="text-muted-foreground text-lg leading-relaxed">
        ¡Bienvenido! En esta guía aprenderás a gestionar los traslados de inventario de manera eficiente en Shopify 2026. Mantener el stock sincronizado entre sucursales es clave para nuestras operaciones en Bukz.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">01</span>
        Tipos de Traslado
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🏠 Entre Sucursales</h3>
          <p className="text-sm text-muted-foreground">Mueve productos entre nuestras ubicaciones físicas de forma interna.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🔄 Sin Origen</h3>
          <p className="text-sm text-muted-foreground">Ideal para entregas inesperadas o sistemas externos sin origen previo.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🗑️ Destino No Especificado</h3>
          <p className="text-sm text-muted-foreground">Para mermas, bajas o envíos a almacenes de terceros (3PL).</p>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">02</span>
        Pasos para Crear un Traslado
      </h2>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">1</div>
          <p className="text-sm text-foreground">Entra al panel de <strong>Shopify Admin (Verde)</strong>.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">2</div>
          <p className="text-sm text-foreground">Ve a la sección de <strong>Productos</strong> &gt; <strong>Traslados</strong> (Transfers).</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">3</div>
          <p className="text-sm text-foreground">Haz clic en <strong>"Crear Traslado"</strong> y selecciona el origen y destino.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">4</div>
          <p className="text-sm text-foreground">Añade los productos buscando por nombre, escaneando el código de barras o subiendo un archivo CSV con los titulos <strong>SKU</strong> y <strong>Quantity</strong>.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">5</div>
          <p className="text-sm text-foreground">Guarda como borrador o marca como <strong>"Enviar"</strong> para iniciar el seguimiento.</p>
        </div>
      </div>
    </section>

    <section className="space-y-4 p-6 rounded-2xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/20">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">💡 Información Pro (2026)</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-foreground/80">
        <li><strong>Edición Dinámica:</strong> Ahora puedes editar envíos incluso después de haber sido marcados como enviados.</li>
        <li><strong>AI Sidekick:</strong> Pregunta a Sidekick "¿Cómo va el traslado a la sede Bukz?" para actualizaciones en tiempo real.</li>
        <li><strong>Capacidad:</strong> Shopify ahora soporta hasta <strong>2,048 variantes</strong> por producto en traslados.</li>
      </ul>
    </section>

    <section className="text-center py-8">
      <p className="text-muted-foreground text-sm italic">
        Mantener un inventario preciso es nuestra prioridad. Ante cualquier duda, contacta al equipo de Operaciones.
        operaciones@bukz.co / cedi@bukz.co
      </p>
    </section>
  </>
);

const FacturacionPOSContent = () => (
  <>
    <section className="space-y-4">
      <p className="text-muted-foreground text-lg leading-relaxed">
        ¡Hola! En esta guía aprenderás el proceso correcto de facturación utilizando <strong>Shopify POS</strong>. Realizar un cobro rápido y eficiente es fundamental para brindar una excelente experiencia en nuestras librerías.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">01</span>
        Formas de Pago admitidas
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">💵 Efectivo y Tarjetas</h3>
          <p className="text-sm text-muted-foreground">Cobros tradicionales a través del datáfono o efectivo en caja.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-purple-500/5 dark:bg-purple-500/10">
          <h3 className="font-medium text-purple-700 dark:text-purple-400 mb-1">🎁 Tarjeta de Regalo (Gift Card)</h3>
          <p className="text-sm text-purple-800/80 dark:text-purple-200/80">Canjea tarjetas compradas online o en tienda física escaneando el código.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">➕ Pagos Divididos</h3>
          <p className="text-sm text-muted-foreground">Permite al cliente usar dos métodos de pago (ej: Gift Card + Efectivo).</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🏠 Retiro en Tienda</h3>
          <p className="text-sm text-muted-foreground">Factura pedidos realizados online que el cliente viene a recoger.</p>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">02</span>
        Pasos para procesar la venta
      </h2>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">1</div>
          <p className="text-sm text-foreground">Añade los libros al carrito buscando por título o usando el <strong>escáner de código de barras</strong> de la tablet.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">2</div>
          <p className="text-sm text-foreground">Busca y selecciona al <strong>cliente</strong> en el buscador de arriba. Si no existe, haz clic en <strong>"Añadir cliente"</strong> y completa sus datos (Nombre, NIT/Cédula y Email).</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">3</div>
          <p className="text-sm text-foreground">Pulsa el botón <strong>"Pago"</strong> (Checkout) en la parte inferior derecha.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">4</div>
          <p className="text-sm text-foreground">Selecciona el método de pago elegido por el cliente.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">5</div>
          <div className="space-y-2">
            <p className="text-sm text-foreground italic font-medium">Si el pago es con Gift Card:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Elige <strong>"Tarjeta de Regalo"</strong>.</li>
              <li>Escanea el código QR con la cámara frontal o escribe el código manualmente.</li>
              <li>Pulsa en <strong>"Canjear"</strong> (Redeem).</li>
            </ul>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">6</div>
          <p className="text-sm text-foreground">Finaliza entregando el recibo digital (vía email) o impreso.</p>
        </div>
      </div>
    </section>

    <section className="space-y-4 p-6 rounded-2xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/20">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">💡 Datos clave Shopify POS</h2>
      <ul className="list-disc list-inside space-y-2 text-sm text-foreground/80">
        <li><strong>Facturación Electrónica:</strong> Se agradece ingresar los <strong>datos completos del cliente</strong> (Nombre, NIT/Cédula, Email) para asegurar que la factura electrónica se emita correctamente.</li>
        <li><strong>Saldo en tiempo real:</strong> Las Gift Cards funcionan tanto online como en físico; el saldo se actualiza al instante.</li>
        <li><strong>Pagos Parciales:</strong> Si la Gift Card no cubre el total, pulsa <strong>"Añadir pago"</strong> para cobrar el resto por otro medio.</li>
        <li><strong>Devoluciones:</strong> Siempre que sea posible, realiza la devolución al mismo medio de pago (especialmente en Gift Cards).</li>
      </ul>
    </section>

    <section className="text-center py-8">
      <p className="text-muted-foreground text-sm italic">
        Una venta bien registrada es una base de datos feliz. Ante problemas técnicos, contacta soporte.
      </p>
    </section>
  </>
);

const PedidosCanceladosContent = () => (
  <>
    <section className="space-y-4">
      <p className="text-muted-foreground text-lg leading-relaxed">
        ¡Hola! En esta guía aprenderás el proceso estándar para gestionar <strong>pedidos cancelados, devoluciones y cambios</strong> en Shopify 2026. Manejar estos procesos con claridad es vital para la confianza de nuestros clientes.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">01</span>
        Cómo Cancelar un Pedido
      </h2>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          La cancelación detiene el procesamiento de un pedido. Se usa cuando un cliente lo solicita, si hay sospecha de fraude o si no hay stock disponible.
        </p>
        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">1</div>
            <p className="text-sm text-foreground">Ve a <strong>Pedidos</strong> y haz clic en el pedido específico.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">2</div>
            <p className="text-sm text-foreground">Verifica que el pedido <strong>no esté preparado</strong> (Unfulfilled) para poder cancelarlo.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">3</div>
            <p className="text-sm text-foreground">Haz clic en <strong>Más acciones &gt; Cancelar pedido</strong>.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">4</div>
            <div className="space-y-2">
              <p className="text-sm text-foreground italic font-medium">Configura las opciones de cancelación:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li><strong>Reembolsar pago:</strong> Elige entre el <em>Método original</em> o <em>el que se necesite para el caso</em>.</li>
                <li><strong>Motivo:</strong> Selecciona la razón (ej: Cliente cambió de opinión).</li>
                <li><strong>Inventario:</strong> Marca <strong>"Reponer inventario"</strong> para que los libros vuelvan al stock automáticamente.</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">5</div>
            <p className="text-sm text-foreground">Haz clic en el botón rojo <strong>Cancelar pedido</strong>.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">02</span>
        Cambio de Libro (Editar Pedido)
      </h2>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Si el cliente quiere cambiar un libro por otro, no es necesario cancelar. Podemos <strong>editar el pedido</strong> directamente si aún no ha sido preparado.
        </p>
        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">1</div>
            <p className="text-sm text-foreground">Entra al pedido y haz clic en el botón <strong>Editar</strong> (arriba a la derecha).</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">2</div>
            <p className="text-sm text-foreground"><strong>Para eliminar el libro anterior:</strong> Pasa el ratón sobre el producto y haz clic en la <strong>"x"</strong>. Asegúrate de que "Reponer unidades" esté marcado.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">3</div>
            <p className="text-sm text-foreground"><strong>Para añadir el nuevo libro:</strong> Haz clic en <strong>+ Añadir producto</strong>, búscalo y selecciónalo.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">4</div>
            <p className="text-sm text-foreground">Haz clic en <strong>Revisar cambios</strong>. El sistema te mostrará si hay un saldo a favor del cliente o si debe pagar una diferencia.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-none h-6 w-6 rounded-full bg-zinc-800 dark:bg-zinc-700 text-zinc-50 flex items-center justify-center text-xs font-bold shadow-sm">5</div>
            <p className="text-sm text-foreground">Haz clic en <strong>Actualizar pedido</strong> para guardar.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">03</span>
        Opciones de Reembolso
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <h3 className="font-medium text-foreground mb-1">🏦 Método Original</h3>
          <p className="text-sm text-muted-foreground">Es la opción por defecto. Shopify devuelve el dinero a la tarjeta o medio usado por el cliente.</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-purple-500/5 dark:bg-purple-500/10">
          <h3 className="font-medium text-purple-700 dark:text-purple-400 mb-1">🎁 Tarjeta de Regalo</h3>
          <p className="text-sm text-purple-800/80 dark:text-purple-200/80">El cliente recibe un código por el valor del reembolso para usarlo en una futura compra.</p>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-lg text-sm font-bold border border-zinc-500/20">04</span>
        Notas Importantes
      </h2>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>• <strong>Limitación de Edición:</strong> Solo puedes editar o eliminar artículos que <strong>aún no han sido preparados</strong>.</p>
        <p>• <strong>Cargos por transacción:</strong> Shopify <strong>no devuelve</strong> las comisiones de tarjeta de crédito al emitir un reembolso.</p>
        <p>• <strong>Estado del pago:</strong> Si el pago no fue capturado, aparecerá como <em>Anulado</em>. Si fue capturado y devuelto, aparecerá como <em>Reembolsado</em>.</p>
        <p>• <strong>Políticas:</strong> Es fundamental aplicar siempre las <strong>políticas de cambio o reembolsos</strong> vigentes en la empresa.</p>
        <p>• <strong>Comunicación:</strong> Mantén contacto constante con las áreas de <strong>Contabilidad y Operaciones</strong> ante cualquier duda o proceso especial.</p>
      </div>
    </section>

    <section className="space-y-4 p-6 rounded-2xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/20">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">💡 Recordatorio</h2>
      <p className="text-sm text-foreground/80">
        Antes de cancelar un pedido preparado (fulfilled), asegúrate de que puedes detener el envío con la transportista o que el paquete aún no ha salido de la bodega.
      </p>
    </section>

    <section className="text-center py-8">
      <p className="text-muted-foreground text-sm italic">
        Convertir una mala experiencia de compra en una buena devolución es la mejor forma de fidelizar.
      </p>
    </section>
  </>
);

const GuideDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const guide = slug ? guidesMeta[slug] : null;

  if (!guide) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Guía no encontrada</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/instructions")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const renderContent = () => {
    switch (slug) {
      case "permisos-y-vacaciones":
        return <PermisosContent />;
      case "traslados":
        return <TrasladosContent />;
      case "facturacion-pos":
        return <FacturacionPOSContent />;
      case "pedidos-cancelados-y-devoluciones":
        return <PedidosCanceladosContent />;
      default:
        return (
          <section className="py-12 text-center text-muted-foreground">
            <p>El contenido de esta guía está en construcción.</p>
          </section>
        );
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/instructions")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Volver a Guías
      </Button>

      <div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {guide.categories.map((cat) => (
            <span
              key={cat}
              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground"
            >
              {cat}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{guide.title}</h1>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default GuideDetail;

