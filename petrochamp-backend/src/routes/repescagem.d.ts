declare const router: import("express-serve-static-core").Router;
export declare function getEligibleTeams(championship: string, phase: number): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    name: string;
    institution: string;
    category: string;
    logoUrl: string | null;
    group: string | null;
    bracketPosition: number | null;
}[]>;
export default router;
//# sourceMappingURL=repescagem.d.ts.map