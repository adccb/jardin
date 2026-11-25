# 📸 garden, bien arreglado

Un paseo por cada página con los colores predeterminados 🌹 Rosé Pine, ☀️ en claro a la izquierda y 🌙 en oscuro a la derecha. Todo lo que ves es inventado: el equipo «sunbeam-labs», sus repos, PR, tickets y tareas vienen de [`demo/fixtures.rb`](demo/fixtures.rb), no de GitHub, Jira ni Todoist.

[🍔 English](README.md) · [🥐 Français](README.fr.md) · **🌽 Español** · [🍙 日本語](README.ja.md)  
🎨 [Cada página en las otras paletas (en inglés)](palettes.md) · 🧺 [Cada jardín en todos los colores (en inglés)](by-page/README.md)

## 🌻 inicio

El inicio: lo que está listo para fusionar, lo que espera tu revisión, lo que vence hoy y tus tickets de Jira.
![00-home](es/00-home.jpg)

## 💌 jardín de PR

Tus PR abiertas, agrupadas en listas para fusionar, por pulir, esperando revisión y borradores, con el panel de repos a la izquierda.
![01-pr-garden](es/01-pr-garden.jpg)

El filtro de fusionadas, para admirar lo que ya llegó.
![02-pr-garden-merged](es/02-pr-garden-merged.jpg)

## 👀 jardín de revisiones

Las PR que te pidieron revisión por tu nombre.
![03-review-garden](es/03-review-garden.jpg)

La pestaña del equipo, con un repo desmarcado en el panel.
![04-review-garden-team](es/04-review-garden-team.jpg)

## 📝 jardín de tareas

El panel de listas a la izquierda, con hoy y atrasadas como pestañas.
![05-task-garden](es/05-task-garden.jpg)

Plantar una tarea nueva (`c`).
![06-task-garden-new-task](es/06-task-garden-new-task.jpg)

La ayuda del teclado (`?`).
![07-task-garden-keyboard-help](es/07-task-garden-keyboard-help.jpg)

## 🌿 jardín de ramas

Una pestaña por cada repo del panel, con el estado de la PR, el upstream y el worktree de cada rama.
![08-branch-garden](es/08-branch-garden.jpg)

Ordenar dos ramas fusionadas de una vez.
![09-branch-garden-tidy](es/09-branch-garden-tidy.jpg)

## 🏡 jardín de worktrees

Una pestaña de worktrees por repo, incluido un fantasma cuya carpeta ya no existe.
![10-worktree-garden](es/10-worktree-garden.jpg)

## 🎟️ jardín de tickets

Tus tickets en carriles por épica, con el panel de sprints a la izquierda.
![11-ticket-garden](es/11-ticket-garden.jpg)

Una pestaña de sprint, con los tickets de todo el equipo y un filtro por persona en cada carril.
![12-ticket-garden-sprint](es/12-ticket-garden-sprint.jpg)

Un ticket abierto en el panel lateral.
![13-ticket-garden-ticket](es/13-ticket-garden-ticket.jpg)

## ⚙️ ajustes

Colores e idioma arriba, las páginas de la barra lateral, y debajo ocultar repos en todas partes a la vez; la lista de repos viene de GitHub.
![14-settings](es/14-settings.jpg)

## Cómo volver a tomarlas

El servidor de demo corre las páginas reales con cada API cambiada por los datos inventados, y cada `?scene=` prepara una página (pestañas, diálogos, filtros guardados). El fotógrafo maneja Chrome sin interfaz, así que necesita Google Chrome instalado; después `gallery.rb` reescribe estas páginas.

```sh
ruby docs/screenshots/demo/demo_garden.rb &                     # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots            # cada escena, idioma y paleta
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket  # solo una escena
ruby docs/screenshots/demo/gallery.rb                           # reescribir las galerías
```

Las escenas viven en [`demo/scenes.rb`](demo/scenes.rb) y los textos al pie en [`demo/gallery.rb`](demo/gallery.rb).
