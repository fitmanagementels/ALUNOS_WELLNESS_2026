export default {
  fetch() {
    return new Response('Acesso do XSTEAM Gestão em configuração.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};
