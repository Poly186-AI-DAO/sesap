import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Agreements</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">0</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Signatures</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">0</div>
                </CardContent>
            </Card>
        </div>
    );
}
