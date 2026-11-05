// "Barbearia do Zé!" -> "barbearia-do-ze"
export function slugify(text: string) {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");

  return slug || "estabelecimento";
}
