const compactNumberFormater = new Intl.NumberFormat(undefined, {
    notation: "compact",
})

export function formatCompactNumber(number: number) {
    return compactNumberFormater.format(number)
}