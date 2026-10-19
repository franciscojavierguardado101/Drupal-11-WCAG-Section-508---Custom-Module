<?php

namespace Drupal\francisco_wcag_checker\Controller;

use Drupal\Core\Controller\ControllerBase;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\RequestException;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Fetches a public URL server-side so the browser avoids CORS restrictions.
 *
 * Security: blocks localhost, loopback, and private RFC-1918 ranges to
 * prevent SSRF. Mirrors the validation in the Next.js wcag-scan-url route.
 */
class WcagProxyController extends ControllerBase {

  protected ClientInterface $httpClient;

  public function __construct(ClientInterface $http_client) {
    $this->httpClient = $http_client;
  }

  public static function create(ContainerInterface $container): static {
    return new static($container->get('http_client'));
  }

  public function proxy(Request $request): JsonResponse {
    if (!$request->isXmlHttpRequest()) {
      return new JsonResponse(['error' => 'Invalid request.'], 400);
    }

    $body = json_decode($request->getContent(), TRUE);
    $url  = trim($body['url'] ?? '');

    if (!$url) {
      return new JsonResponse(['error' => 'url is required.'], 400);
    }

    $validation = $this->validateUrl($url);
    if ($validation !== TRUE) {
      return new JsonResponse(['error' => $validation], 422);
    }

    try {
      $response = $this->httpClient->get($url, [
        'timeout'         => 20,
        'verify'          => FALSE,
        'allow_redirects' => ['max' => 5],
        'headers'         => [
          'User-Agent' => 'Mozilla/5.0 (compatible; WCAG-Checker/1.0; +https://franciscojavierguardado.com)',
          'Accept'     => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ],
      ]);

      $html = (string) $response->getBody();

      if (strlen($html) > 2_000_000) {
        return new JsonResponse(['error' => 'Page content exceeds 2 MB limit.'], 413);
      }

      return new JsonResponse(['html' => $html]);
    }
    catch (RequestException $e) {
      return new JsonResponse(
        ['error' => 'Failed to fetch URL: ' . $e->getMessage()],
        500
      );
    }
  }

  private function validateUrl(string $url): true|string {
    $parsed = parse_url($url);

    if (!$parsed || empty($parsed['host'])) {
      return 'Invalid URL format.';
    }
    if (!in_array($parsed['scheme'] ?? '', ['http', 'https'], TRUE)) {
      return 'Only http:// and https:// URLs are allowed.';
    }

    $host = $parsed['host'];
    $blocked = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    if (in_array($host, $blocked, TRUE)) {
      return 'Scanning localhost or loopback addresses is not allowed.';
    }
    if (preg_match('/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|fc00:|fe80:)/i', $host)) {
      return 'Scanning private or internal IP ranges is not allowed.';
    }

    return TRUE;
  }

}
