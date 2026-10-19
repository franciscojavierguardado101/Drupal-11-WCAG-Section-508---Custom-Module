<?php

namespace Drupal\francisco_wcag_checker\Form;

use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

/**
 * Standalone WCAG / Section 508 accessibility scanner form.
 *
 * Scanning is performed client-side by axe-core injected into a sandboxed
 * srcdoc iframe. The URL proxy route handles server-side URL fetching so
 * the browser never makes a cross-origin request directly.
 */
class WcagCheckerForm extends FormBase {

  public function getFormId(): string {
    return 'wcag_checker_form';
  }

  public function buildForm(array $form, FormStateInterface $form_state): array {
    $module_path = \Drupal::service('extension.list.module')
      ->getPath('francisco_wcag_checker');

    $base = \Drupal::request()->getSchemeAndHttpHost() . base_path();

    $form['#attached']['library'][] = 'francisco_wcag_checker/wcag_checker';
    $form['#attached']['drupalSettings']['wcagChecker'] = [
      'axePath'   => rtrim($base, '/') . '/' . $module_path . '/js/axe.min.js',
      'proxyPath' => Url::fromRoute('francisco_wcag_checker.proxy')->toString(),
    ];

    $form['#attributes']['class'][]   = 'wcag-checker-form';
    $form['#attributes']['novalidate'] = TRUE;

    // ── Subtitle ──────────────────────────────────────────────────────────────
    $form['subtitle'] = [
      '#type'       => 'html_tag',
      '#tag'        => 'p',
      '#value'      => $this->t('Powered by axe-core &nbsp;·&nbsp; WCAG 2.1 AA / Section 508 &nbsp;·&nbsp; ~57% automated coverage'),
      '#attributes' => ['class' => ['wcag-subtitle']],
    ];

    // ── Mode tabs ─────────────────────────────────────────────────────────────
    $form['tabs'] = [
      '#type'       => 'container',
      '#attributes' => ['class' => ['wcag-tabs'], 'role' => 'tablist'],
    ];
    $form['tabs']['url_tab'] = [
      '#type'       => 'html_tag',
      '#tag'        => 'button',
      '#value'      => $this->t('URL Scanner'),
      '#attributes' => [
        'type'          => 'button',
        'class'         => ['wcag-tab', 'wcag-tab--active'],
        'data-mode'     => 'url',
        'role'          => 'tab',
        'aria-selected' => 'true',
        'aria-controls' => 'wcag-panel-url',
      ],
    ];
    $form['tabs']['html_tab'] = [
      '#type'       => 'html_tag',
      '#tag'        => 'button',
      '#value'      => $this->t('HTML Inspector'),
      '#attributes' => [
        'type'          => 'button',
        'class'         => ['wcag-tab'],
        'data-mode'     => 'html',
        'role'          => 'tab',
        'aria-selected' => 'false',
        'aria-controls' => 'wcag-panel-html',
      ],
    ];

    // ── URL panel ─────────────────────────────────────────────────────────────
    $form['url_panel'] = [
      '#type'       => 'container',
      '#attributes' => [
        'id'              => 'wcag-panel-url',
        'class'           => ['wcag-panel'],
        'role'            => 'tabpanel',
        'aria-labelledby' => 'wcag-tab-url',
      ],
    ];
    $form['url_panel']['url_row'] = [
      '#type'       => 'container',
      '#attributes' => ['class' => ['wcag-url-row']],
    ];
    $form['url_panel']['url_row']['url'] = [
      '#type'        => 'url',
      '#title'       => $this->t('PUBLIC URL — paste any publicly accessible webpage'),
      '#placeholder' => 'https://example.com/page',
      '#attributes'  => ['class' => ['wcag-input'], 'id' => 'wcag-url-input'],
      '#description' => $this->t('Only http:// and https:// URLs. Localhost and private networks are blocked.'),
    ];
    $form['url_panel']['url_row']['url_submit'] = [
      '#type'       => 'button',
      '#value'      => $this->t('Scan URL →'),
      '#attributes' => [
        'class'     => ['wcag-btn', 'wcag-btn--primary', 'js-wcag-submit'],
        'data-mode' => 'url',
      ],
    ];

    // ── HTML panel ────────────────────────────────────────────────────────────
    $form['html_panel'] = [
      '#type'       => 'container',
      '#attributes' => [
        'id'              => 'wcag-panel-html',
        'class'           => ['wcag-panel', 'wcag-panel--hidden'],
        'role'            => 'tabpanel',
        'aria-labelledby' => 'wcag-tab-html',
      ],
    ];
    $form['html_panel']['html'] = [
      '#type'        => 'textarea',
      '#title'       => $this->t('HTML — paste from browser Inspect panel (right-click → Inspect, copy any element or the full &lt;body&gt;)'),
      '#rows'        => 8,
      '#placeholder' => "<section>\n  <h1>Page Title</h1>\n  <img src=\"hero.jpg\" />\n</section>",
      '#attributes'  => [
        'class' => ['wcag-input', 'wcag-textarea'],
        'id'    => 'wcag-html-input',
      ],
    ];
    $form['html_panel']['css'] = [
      '#type'        => 'textarea',
      '#title'       => $this->t('CSS (optional but recommended — enables color contrast checks)'),
      '#rows'        => 4,
      '#placeholder' => "/* paste your stylesheet or relevant rules */\nbody { background: #fff; color: #111; }",
      '#attributes'  => [
        'class' => ['wcag-input', 'wcag-textarea'],
        'id'    => 'wcag-css-input',
      ],
      '#description' => $this->t('Without CSS, color contrast checks are skipped. Fragments are automatically wrapped in a valid HTML document.'),
    ];
    $form['html_panel']['html_submit'] = [
      '#type'       => 'button',
      '#value'      => $this->t('Analyze HTML →'),
      '#attributes' => [
        'class'     => ['wcag-btn', 'wcag-btn--primary', 'js-wcag-submit'],
        'data-mode' => 'html',
      ],
    ];

    // ── Results container ─────────────────────────────────────────────────────
    $form['results'] = [
      '#type'       => 'container',
      '#attributes' => [
        'id'          => 'wcag-results',
        'class'       => ['wcag-results'],
        'aria-live'   => 'polite',
        'aria-atomic' => 'true',
      ],
    ];

    return $form;
  }

  public function submitForm(array &$form, FormStateInterface $form_state): void {
    // All interaction is handled by wcag-checker.js.
  }

}
