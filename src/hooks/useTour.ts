import { useCallback } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_COMPLETED_KEY = "bukzbrain-tour-completed";

// Map nav paths to their tour step (element selector + content)
const navTourSteps: { path: string; step: DriveStep }[] = [
  {
    path: "/dashboard",
    step: {
      element: "#nav-dashboard",
      popover: {
        title: "Dashboard",
        description:
          "Tu panel principal. Muestra un resumen en tiempo real de tus tareas personales activas y las devoluciones a proveedores en curso, para que tengas todo bajo control de un vistazo.",
        side: "right" as const,
        align: "start" as const,
      },
    },
  },
  {
    path: "/operations",
    step: {
      element: "#nav-operations",
      popover: {
        title: "Operaciones",
        description:
          "Centro de coordinación entre áreas. Crea y gestiona tareas compartidas organizadas por departamento (General, Devolución, SAC, Operaciones), comparte archivos y da seguimiento al progreso de cada tarea con subtareas y notas.",
        side: "right" as const,
        align: "start" as const,
      },
    },
  },
  {
    path: "/tasks",
    step: {
      element: "#nav-tasks",
      popover: {
        title: "Tareas",
        description:
          "Tu tablero personal de productividad. Crea tareas con prioridades (Baja, Media, Alta, Urgente), asigna tareas a otros miembros del equipo, establece fechas de inicio y vencimiento, agrega subtareas y notas, y reorganiza todo con arrastrar y soltar.",
        side: "right" as const,
        align: "start" as const,
      },
    },
  },
  {
    path: "/instructions",
    step: {
      element: "#nav-instructions",
      popover: {
        title: "Guías",
        description:
          "Base de conocimiento del equipo. Consulta instrucciones detalladas sobre productos, procesos operativos, uso de punto de venta, manejo de inventario, transferencias y más. Filtra por categoría para encontrar lo que necesitas.",
        side: "right" as const,
        align: "start" as const,
      },
    },
  },
  {
    path: "/requests",
    step: {
      element: "#nav-requests",
      popover: {
        title: "Solicitudes",
        description:
          "Gestiona tus solicitudes de permisos: vacaciones, licencias remuneradas, licencias no remuneradas y días de cumpleaños. Crea solicitudes, selecciona fechas y sigue el estado de aprobación en un solo lugar.",
        side: "right" as const,
        align: "start" as const,
      },
    },
  },
  {
    path: "/bookstore-requests",
    step: {
      element: "#nav-bookstore",
      popover: {
        title: "Solicitud Librerías",
        description:
          "Realiza pedidos de materiales y productos para las librerías. Especifica cantidades, selecciona categorías y da seguimiento al estado de cada solicitud hasta su aprobación y entrega.",
        side: "right" as const,
        align: "start" as const,
      },
    },
  },
];

const headerSteps: DriveStep[] = [
  {
    element: "#header-search",
    popover: {
      title: "Búsqueda Rápida",
      description:
        "Busca cualquier cosa dentro de la aplicación de forma rápida. Accede a páginas, guías y más con solo escribir.",
      side: "bottom" as const,
      align: "center" as const,
    },
  },
  {
    element: "#sidebar-theme",
    popover: {
      title: "Cambiar Tema",
      description:
        "Alterna entre modo claro y oscuro según tu preferencia. Encontrarás este botón aquí en la parte inferior del menú. Tu elección se guarda automáticamente.",
      side: "right" as const,
      align: "end" as const,
    },
  },
  {
    element: "#header-user",
    popover: {
      title: "Tu Perfil",
      description:
        "Aquí puedes ver tu usuario actual y cerrar sesión cuando lo necesites.",
      side: "bottom" as const,
      align: "end" as const,
    },
  },
  {
    element: "#btn-help-tour",
    popover: {
      title: "Botón de Ayuda",
      description:
        "¡Ese soy yo! Puedes iniciar este recorrido en cualquier momento haciendo clic aquí. ¡Disfruta BukzBrain!",
      side: "bottom" as const,
      align: "end" as const,
    },
  },
];

export function useTour(allowedPages: Set<string>) {
  const hasCompletedTour = localStorage.getItem(TOUR_COMPLETED_KEY) === "true";

  const startTour = useCallback(() => {
    // Filter nav steps based on user permissions
    const visibleNavSteps = navTourSteps
      .filter((s) => allowedPages.has(s.path))
      .map((s) => s.step);

    // Only include header steps for elements visible in the DOM
    const visibleHeaderSteps = headerSteps.filter(
      (s) => !s.element || document.querySelector(s.element)
    );

    const steps: DriveStep[] = [
      {
        popover: {
          title: "👋 ¡Bienvenido a BukzBrain!",
          description:
            "Esta es tu plataforma de gestión operativa. Te haremos un recorrido rápido por los módulos disponibles para ti.",
          side: "over" as const,
          align: "center" as const,
        },
      },
      ...visibleNavSteps,
      ...visibleHeaderSteps,
    ];

    const driverObj = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "bukzbrain-tour",
      nextBtnText: "Siguiente →",
      prevBtnText: "← Anterior",
      doneBtnText: "¡Entendido!",
      progressText: "{{current}} de {{total}}",
      steps,
      onDestroyed: () => {
        localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      },
    });

    driverObj.drive();
  }, [allowedPages]);

  return { startTour, hasCompletedTour };
}
