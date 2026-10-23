/**
 * `<script type="application/ld+json">` 본문용 직렬화.
 *
 * JSON.stringify 는 `</script>` 를 이스케이프하지 않는다. 앱 이름·설명·게시글처럼 회원이 입력한
 * 값이 JSON-LD 에 들어가므로, 그대로 넣으면 `</script><script>…` 로 스크립트 블록을 빠져나와
 * 방문자 브라우저에서 코드가 실행될 수 있다. `<` `>` `&` 와 JS 줄바꿈 문자(U+2028, U+2029)를
 * \u 이스케이프로 바꾼다 — JSON 값은 그대로 유지된다.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
