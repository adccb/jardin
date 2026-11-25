# Writes the screenshot galleries: README.md, README.fr.md, README.es.md and README.ja.md (Rosé Pine, one per language)
# and palettes.md (every scene in each other palette, in English). Page names come from the app's own locale files.
# usage: ruby gallery.rb   (run after shoot.rb; it writes into docs/screenshots)
require_relative '../../../lib/garden'
require_relative 'scenes'

module Demo
  module Gallery
    module_function

    ROOT = File.expand_path('..', __dir__)
    LANGS = %w[en fr es ja].freeze
    FILES = { 'en' => 'README.md', 'fr' => 'README.fr.md', 'es' => 'README.es.md', 'ja' => 'README.ja.md' }.freeze
    PALETTES = {
      'rose-pine' => ['🌹', 'Rosé Pine', 'The default: Dawn by day, Main by night.'],
      'catppuccin' => ['🐈', 'Catppuccin', 'Latte by day, Mocha by night.'],
      'everforest' => ['🌲', 'Everforest', 'Light by day, Dark by night, both at medium contrast.'],
      'nightfox' => ['🦊', 'Nightfox', 'Dayfox by day, Nightfox by night.'],
      'dracula' => ['🧛', 'Dracula', 'Alucard by day, Dracula by night.'],
      'tokyo-night' => ['🌃', 'Tokyo Night', 'Day by day, Moon by night.']
    }.freeze
    PAGE_EMOJI = { 'prs' => '💌', 'reviews' => '👀', 'tasks' => '📝', 'branches' => '🌿', 'worktrees' => '🏡', 'jira' => '🎟️', 'settings' => '⚙️' }.freeze

    TEXT = {
      'en' => {
        title: '📸 garden, all dressed up',
        intro: 'A walk through every page in the default 🌹 Rosé Pine colors, ☀️ light on the left and 🌙 dark on the right. Everything you see is invented: the "sunbeam-labs" team, its repos, PRs, tickets and to-dos come from [`demo/fixtures.rb`](demo/fixtures.rb), not from GitHub, Jira or Todoist.',
        palettes: '🎨 [Every page in the other color schemes](palettes.md)',
        retake: 'Retaking them',
        retake_body: 'The demo server runs the real pages with every API swapped for the invented data, and each `?scene=` stages a page (tabs, dialogs, saved filters). The shooter drives headless Chrome, so it needs Google Chrome installed; `gallery.rb` then rewrites these pages.',
        comments: ['every scene, every language and palette', 'just one scene', 'rewrite the gallery pages'],
        scenes_note: 'Scenes live in [`demo/scenes.rb`](demo/scenes.rb), captions in [`demo/gallery.rb`](demo/gallery.rb).'
      },
      'fr' => {
        title: '📸 garden, sur son trente-et-un',
        intro: "Une visite de chaque page dans les couleurs par défaut 🌹 Rosé Pine, ☀️ en clair à gauche et 🌙 en sombre à droite. Tout ce que tu vois est inventé : l'équipe « sunbeam-labs », ses dépôts, ses PR, ses tickets et ses tâches viennent de [`demo/fixtures.rb`](demo/fixtures.rb), pas de GitHub, Jira ou Todoist.",
        palettes: '🎨 [Chaque page dans les autres palettes (en anglais)](palettes.md)',
        retake: 'Les refaire',
        retake_body: 'Le serveur de démo fait tourner les vraies pages, avec chaque API remplacée par les données inventées, et chaque `?scene=` met une page en scène (onglets, fenêtres, filtres enregistrés). Le photographe pilote Chrome sans interface, donc il faut que Google Chrome soit installé ; `gallery.rb` réécrit ensuite ces pages.',
        comments: ['chaque scène, langue et palette', 'juste une scène', 'réécrire les galeries'],
        scenes_note: 'Les scènes vivent dans [`demo/scenes.rb`](demo/scenes.rb), les légendes dans [`demo/gallery.rb`](demo/gallery.rb).'
      },
      'es' => {
        title: '📸 garden, bien arreglado',
        intro: 'Un paseo por cada página con los colores predeterminados 🌹 Rosé Pine, ☀️ en claro a la izquierda y 🌙 en oscuro a la derecha. Todo lo que ves es inventado: el equipo «sunbeam-labs», sus repos, PR, tickets y tareas vienen de [`demo/fixtures.rb`](demo/fixtures.rb), no de GitHub, Jira ni Todoist.',
        palettes: '🎨 [Cada página en las otras paletas (en inglés)](palettes.md)',
        retake: 'Cómo volver a tomarlas',
        retake_body: 'El servidor de demo corre las páginas reales con cada API cambiada por los datos inventados, y cada `?scene=` prepara una página (pestañas, diálogos, filtros guardados). El fotógrafo maneja Chrome sin interfaz, así que necesita Google Chrome instalado; después `gallery.rb` reescribe estas páginas.',
        comments: ['cada escena, idioma y paleta', 'solo una escena', 'reescribir las galerías'],
        scenes_note: 'Las escenas viven en [`demo/scenes.rb`](demo/scenes.rb) y los textos al pie en [`demo/gallery.rb`](demo/gallery.rb).'
      },
      'ja' => {
        title: '📸 おめかしした garden',
        intro: 'デフォルトの 🌹 Rosé Pine カラーで全ページをめぐるツアー。左が ☀️ ライト、右が 🌙 ダーク。ここに写っているものはすべて架空のもの：「sunbeam-labs」チーム、そのリポジトリ、PR、チケット、タスクは GitHub や Jira、Todoist ではなく [`demo/fixtures.rb`](demo/fixtures.rb) から来ているよ。',
        palettes: '🎨 [ほかのカラーパレットで見る全ページ（英語）](palettes.md)',
        retake: '撮り直しかた',
        retake_body: 'デモサーバーは本物のページを動かしつつ、すべての API を架空のデータに差し替えているよ。`?scene=` ごとにページを演出（タブ、ダイアログ、保存したフィルター）するんだ。撮影係はヘッドレスの Chrome を操作するので、Google Chrome が必要。そのあと `gallery.rb` がこれらのページを書き直すよ。',
        comments: ['全シーン、全言語、全パレット', 'ひとつのシーンだけ', 'ギャラリーを書き直す'],
        scenes_note: 'シーンは [`demo/scenes.rb`](demo/scenes.rb)、キャプションは [`demo/gallery.rb`](demo/gallery.rb) にあるよ。'
      }
    }.freeze

    CAPTIONS = {
      '01-pr-garden' => {
        'en' => 'Your open PRs, grouped into ready to merge, needs work, waiting on review and drafts, with a repo panel on the left.',
        'fr' => 'Tes PR ouvertes, rangées en prêtes à merger, à retravailler, en attente de relecture et brouillons, avec la liste des dépôts à gauche.',
        'es' => 'Tus PR abiertas, agrupadas en listas para fusionar, por pulir, esperando revisión y borradores, con el panel de repos a la izquierda.',
        'ja' => 'オープンな PR を「マージできる」「手直し」「レビュー待ち」「ドラフト」に分けて表示。左はリポジトリのパネル。'
      },
      '02-pr-garden-merged' => {
        'en' => 'The merged chip, for admiring what already landed.',
        'fr' => 'Le filtre « fusionnées », pour admirer ce qui a déjà atterri.',
        'es' => 'El filtro de fusionadas, para admirar lo que ya llegó.',
        'ja' => '「マージ済み」で、もう着地したものをながめる。'
      },
      '03-review-garden' => {
        'en' => 'PRs that asked for your review by name.',
        'fr' => "Les PR qui t'ont demandée par ton nom.",
        'es' => 'Las PR que te pidieron revisión por tu nombre.',
        'ja' => '名前指定でレビューを依頼された PR。'
      },
      '04-review-garden-team' => {
        'en' => 'The team tab, with one repo unchecked in the panel.',
        'fr' => "L'onglet équipe, avec un dépôt décoché dans le panneau.",
        'es' => 'La pestaña del equipo, con un repo desmarcado en el panel.',
        'ja' => 'チームのタブ。パネルでリポジトリをひとつチェックから外した状態。'
      },
      '05-task-garden' => {
        'en' => 'The lists panel on the left, with today and late showing as tabs.',
        'fr' => "Le panneau des listes à gauche, avec aujourd'hui et en retard affichées en onglets.",
        'es' => 'El panel de listas a la izquierda, con hoy y atrasadas como pestañas.',
        'ja' => '左にリストのパネル、「今日」と「期限切れ」をタブで表示。'
      },
      '06-task-garden-new-task' => {
        'en' => 'Planting a new task (`c`).', 'fr' => 'Planter une nouvelle tâche (`c`).',
        'es' => 'Plantar una tarea nueva (`c`).', 'ja' => '新しいタスクを植える（`c`）。'
      },
      '07-task-garden-keyboard-help' => {
        'en' => 'The keyboard help (`?`).', 'fr' => "L'aide du clavier (`?`).",
        'es' => 'La ayuda del teclado (`?`).', 'ja' => 'キーボードのヘルプ（`?`）。'
      },
      '08-branch-garden' => {
        'en' => 'One tab per repo in the panel, its branches showing PR state, upstream and worktree badges.',
        'fr' => "Un onglet par dépôt du panneau, avec l'état de la PR, l'upstream et le worktree de chaque branche.",
        'es' => 'Una pestaña por cada repo del panel, con el estado de la PR, el upstream y el worktree de cada rama.',
        'ja' => 'パネルのリポジトリごとにタブ。各ブランチの PR の状態、upstream、ワークツリーのバッジ。'
      },
      '09-branch-garden-tidy' => {
        'en' => 'Tidying two merged branches at once.', 'fr' => "Ranger deux branches mergées d'un coup.",
        'es' => 'Ordenar dos ramas fusionadas de una vez.', 'ja' => 'マージ済みのブランチをふたつまとめてお片付け。'
      },
      '10-worktree-garden' => {
        'en' => 'One tab per repo of worktrees, including a ghost whose folder is gone.',
        'fr' => 'Un onglet de worktrees par dépôt, dont un fantôme dont le dossier a disparu.',
        'es' => 'Una pestaña de worktrees por repo, incluido un fantasma cuya carpeta ya no existe.',
        'ja' => 'リポジトリごとのワークツリーのタブ。フォルダが消えたおばけもいるよ。'
      },
      '11-ticket-garden' => {
        'en' => 'Your tickets in swimlanes by epic, with the sprints panel on the left.',
        'fr' => 'Tes tickets en couloirs par epic, avec la liste des sprints à gauche.',
        'es' => 'Tus tickets en carriles por épica, con el panel de sprints a la izquierda.',
        'ja' => 'エピックごとのレーンに並んだ自分のチケット。左はスプリントのパネル。'
      },
      '12-ticket-garden-sprint' => {
        'en' => "A sprint tab, with everyone's tickets and per-lane people filters.",
        'fr' => "Un onglet de sprint, avec les tickets de toute l'équipe et un filtre par personne dans chaque couloir.",
        'es' => 'Una pestaña de sprint, con los tickets de todo el equipo y un filtro por persona en cada carril.',
        'ja' => 'スプリントのタブ。チーム全員のチケットと、レーンごとの担当者フィルター。'
      },
      '13-ticket-garden-ticket' => {
        'en' => 'A ticket opened in the drawer.', 'fr' => 'Un ticket ouvert dans le tiroir.',
        'es' => 'Un ticket abierto en el panel lateral.', 'ja' => 'パネルで開いたチケット。'
      },
      '14-settings' => {
        'en' => 'Colors and language up top, then hiding repos everywhere at once; the repo list comes from GitHub.',
        'fr' => "Couleurs et langue en haut, puis cacher des dépôts partout d'un coup ; la liste des dépôts vient de GitHub.",
        'es' => 'Colores e idioma arriba, y debajo ocultar repos en todas partes a la vez; la lista de repos viene de GitHub.',
        'ja' => '上に色と言語、その下でリポジトリをまとめてどこでも隠す。リポジトリのリストはGitHubから。'
      }
    }.freeze

    def language_links(current)
      links = LANGS.map do |lang|
        label = "#{Garden::I18n.t(lang, 'common.flag')} #{Garden::I18n.t(lang, 'common.language_name')}"
        lang == current ? "**#{label}**" : "[#{label}](#{FILES.fetch(lang)})"
      end
      "#{links.join(' · ')}  \n#{TEXT.fetch(current)[:palettes]}"
    end

    def page_slug(scene) = scene[:page].delete_prefix('/')

    # Consecutive scenes on one page share a heading.
    def sections(lang)
      Scenes::LIST.chunk_while { |a, b| page_slug(a) == page_slug(b) }.map do |scenes|
        slug = page_slug(scenes.first)
        ["#{PAGE_EMOJI.fetch(slug)} #{Garden::I18n.t(lang, "#{slug}.title")}", scenes]
      end
    end

    def figure(scene, lang, dir)
      "#{CAPTIONS.fetch(scene[:name]).fetch(lang)}\n![#{scene[:name]}](#{dir}/#{scene[:name]}.jpg)\n"
    end

    def retake(lang)
      text = TEXT.fetch(lang)
      <<~MD
        ## #{text[:retake]}

        #{text[:retake_body]}

        ```sh
        ruby docs/screenshots/demo/demo_garden.rb &                     # http://localhost:4750
        ruby docs/screenshots/demo/shoot.rb docs/screenshots            # #{text[:comments][0]}
        ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket  # #{text[:comments][1]}
        ruby docs/screenshots/demo/gallery.rb                           # #{text[:comments][2]}
        ```

        #{text[:scenes_note]}
      MD
    end

    def language_page(lang)
      text = TEXT.fetch(lang)
      body = sections(lang).map do |heading, scenes|
        "## #{heading}\n\n#{scenes.map { figure(_1, lang, lang) }.join("\n")}"
      end
      "# #{text[:title]}\n\n#{text[:intro]}\n\n#{language_links(lang)}\n\n#{body.join("\n")}\n#{retake(lang)}"
    end

    # Rosé Pine, the default, reuses the English shots from the main gallery; the others have their own folders.
    def palette_dir(id) = id == 'rose-pine' ? 'en' : "palettes/#{id}"

    # One folding section per palette; the default starts open. The blank lines let GitHub render the Markdown inside.
    def palette_section(id, (emoji, name, sides))
      figures = Scenes::LIST.map { figure(_1, 'en', palette_dir(id)) }.join("\n")
      "<details#{if id == 'rose-pine'
                   ' open'
                 end}>\n<summary><h2>#{emoji} #{name}</h2></summary>\n\n#{sides}\n\n#{figures}\n</details>\n"
    end

    def palette_page
      <<~MD
        # 🎨 garden in every color

        Every page in every color scheme, ☀️ light on the left and 🌙 dark on the right, in English. Open a scheme to see
        it; pick one in the app on the ⚙️ settings page. The [main gallery](README.md) has
        Rosé Pine in every language.

        #{PALETTES.map { |id, details| palette_section(id, details) }.join("\n")}
      MD
    end

    def write
      LANGS.each { |lang| File.write(File.join(ROOT, FILES.fetch(lang)), language_page(lang)) }
      File.write(File.join(ROOT, 'palettes.md'), palette_page)
      (FILES.values + ['palettes.md']).each { puts "✓ docs/screenshots/#{_1}" }
    end
  end
end

Demo::Gallery.write if $PROGRAM_NAME == __FILE__
