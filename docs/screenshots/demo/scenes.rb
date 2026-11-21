# Each scene: the page, a localStorage preset and optional steps run after the page loads.
module Demo
  module Scenes
    module_function

    PR_REPOS = %w[sunbeam-labs/petal-api sunbeam-labs/meadow-web sunbeam-labs/fern-cli].freeze

    HELPERS = <<~JS
      const wait = (sel) => new Promise((resolve) => {
        const tick = () => { const el = document.querySelector(sel); el ? resolve(el) : setTimeout(tick, 40); };
        tick();
      });
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const click = async (sel) => (await wait(sel)).click();
      const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      const lang = document.documentElement.lang;
      const NEW_TASK = { en: 'Plant the tulip bulbs before the first frost 🌷', fr: 'Planter les bulbes de tulipes avant les gelées 🌷', es: 'Plantar los bulbos de tulipán antes de la primera helada 🌷', ja: '霜が降りる前にチューリップの球根を植える 🌷' };
      const checkBox = async (sel) => {
        const box = await wait(sel);
        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));
      };
    JS

    LIST = [
      { name: '01-pr-garden', page: '/prs', preset: { 'prs-repos' => PR_REPOS.to_json, 'prs-tab' => 'all' } },
      { name: '02-pr-garden-merged', page: '/prs', preset: { 'prs-repos' => PR_REPOS.to_json, 'prs-tab' => 'all' },
        steps: "await wait('#prs .card'); await click('[data-state=\"merged\"]');" },
      { name: '03-review-garden', page: '/reviews', preset: { 'reviews-tab' => 'you' } },
      { name: '04-review-garden-team', page: '/reviews',
        preset: { 'reviews-tab' => 'team', 'reviews-hidden' => ['sunbeam-labs/seedling-docs'].to_json,
                  'reviews-excluded' => ['sunbeam-labs/pollen-sdk'].to_json },
        steps: "(await wait('#repo-hidden')).open = true;" },
      { name: '05-task-garden', page: '/tasks', preset: { 'tasks-done-open' => 'yes' } },
      { name: '06-task-garden-new-task', page: '/tasks',
        steps: "await wait('#todo-list li'); await click('#new-task'); await sleep(300); " \
               "(await wait('#task-input')).value = NEW_TASK[lang]; await sleep(1500);" },
      { name: '07-task-garden-keyboard-help', page: '/tasks',
        steps: "await wait('#todo-list li'); press('?'); await sleep(1500);" },
      { name: '08-branch-garden', page: '/branches', preset: { 'tab' => 'branches' } },
      { name: '09-branch-garden-tidy', page: '/branches', preset: { 'tab' => 'branches' },
        steps: "await checkBox('[data-key$=\"::sunny/ruby-34\"] input[data-action=\"select\"]'); " \
               "await checkBox('[data-key$=\"::sunny/bloom-log-pii\"] input[data-action=\"select\"]'); await click('#bulk-tidy'); await sleep(1500);" },
      { name: '10-branch-garden-worktrees', page: '/branches', preset: { 'tab' => 'worktrees' } },
      { name: '11-ticket-garden', page: '/jira', preset: { 'jira-view' => 'mine' } },
      { name: '12-ticket-garden-sprint', page: '/jira', preset: { 'jira-view' => 'sprint:501' } },
      { name: '13-ticket-garden-ticket', page: '/jira', preset: { 'jira-view' => 'sprint:501' },
        steps: "await click('[data-key=\"BLOOM-47\"]'); await sleep(2500);" },
      { name: '14-color-menu', page: '/reviews', preset: { 'reviews-tab' => 'you' },
        steps: "await wait('#reviews .card'); await click('#palette-button'); await sleep(800);" }
    ].freeze

    def fetch(name) = LIST.find { |scene| scene[:name] == name }

    def preset_script(scene)
      preset = (scene[:preset] || {}).to_json
      "<script>try { localStorage.clear(); Object.entries(#{preset}).forEach(([k, v]) => localStorage.setItem(k, v)); } catch {}</script>"
    end

    def steps_script(scene)
      "<script type=\"module\">#{HELPERS}\n(async () => { #{scene[:steps]} })();</script>"
    end
  end
end
