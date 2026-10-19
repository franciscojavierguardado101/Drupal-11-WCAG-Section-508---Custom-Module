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

    // ── Mode tabs ─────────────────────────────────────────────────────────────
    $form['tabs'] = [
      '#type'       => 'container',
      '#attributes' => ['class' => ['wcag-tabs'], 'role' => 'tablist'],
    ];
    $form['tabs']['url_tab'] = [
      '#markup' => '<button type="button" class="wcag-tab wcag-tab--active" '
        . 'data-mode="url" role="tab" aria-selected="true" '
        . 'aria-controls="wcag-panel-url">'
        . $this->t('URL Scanner')
        . '</button>',
    ];
    $form['tabs']['html_tab'] = [
      '#markup' => '<button type="button" class="wcag-tab" '
        . 'data-mode="html" role="tab" aria-selected="false" '
        . 'aria-controls="wcag-panel-html">'
        . $this->t('HTML Inspector')
        . '</button>',
    ];

    // ── URL panel ─────────────────────────────────────────────────────────────
    $form['url_panel'] = [
      '#type'       => 'container',
      '#attributes' => [
        'id'         => 'wcag-panel-url',
        'class'      => ['wcag-panel'],
        'role'       => 'tabpanel',
        'aria-labelledby' => 'wcag-tab-url',
      ],
    ];
    $form['url_panel']['url'] = [
      '#type'        => 'url',
      '#title'       => $this->t('Public URL'),
      '#placeholder' => 'https://example.com/page',
      '#attributes'  => ['class' => ['wcag-input'], 'id' => 'wcag-url-input'],
      '#description' => $this->t(
        'Any publicly accessible URL. The server fetches the HTML — JavaScript-rendered pages (React, Vue, Next.js) should use the HTML Inspector tab instead.'
      ),
    ];
    $form['url_panel']['url_submit'] = [
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
        'id'         => 'wcag-panel-html',
        'class'      => ['wcag-panel', 'wcag-panel--hidden'],
        'role'       => 'tabpanel',
        'aria-labelledby' => 'wcag-tab-html',
      ],
    ];
    $form['html_panel']['html'] = [
      '#type'        => 'textarea',
      '#title'       => $this->t('HTML'),
      '#rows'        => 10,
      '#placeholder' => "<section>\n  <h1>Page title</h1>\n  <img src=\"hero.jpg\" alt=\"\" />\n</section>",
      '#attributes'  => [
        'class' => ['wcag-input', 'wcag-textarea'],
        'id'    => 'wcag-html-input',
      ],
      '#description' => $this->t(
        'Paste from your browser\'s Inspect panel (right-click any element → Inspect → copy outer HTML). This captures the rendered DOM including JavaScript changes.'
      ),
    ];
    $form['html_panel']['css'] = [
      '#type'        => 'textarea',
      '#title'       => $this->t('CSS (optional — enables color contrast evaluation)'),
      '#rows'        => 4,
      '#placeholder' => "body { background: #fff; color: #111; }\na { color: #0000ee; }",
      '#attributes'  => [
        'class' => ['wcag-input', 'wcag-textarea'],
        'id'    => 'wcag-css-input',
      ],
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
        'id'         => 'wcag-results',
        'class'      => ['wcag-results'],
        'aria-live'  => 'polite',
        'aria-atomic' => 'true',
      ],
    ];

    return $form;
  }

  public function submitForm(array &$form, FormStateInterface $form_state): void {
    // All interaction is handled by wcag-checker.js.
  }

}
