function logPopulation(population: number | null): number {
    if (!population || population <= 0) {
        return 0;
    }
    return Math.log(population);
}

export function scoreCommune(population: number | null, zoom: number): number {
    return logPopulation(population) + 1.2 + zoom * 0.12;
}

export function scoreInfra(population: number | null, zoom: number): number {
    const zoomBonus = Math.max(0, zoom - 10) * 0.2;
    return logPopulation(population) + 0.8 + zoomBonus;
}

