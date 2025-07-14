using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Linq;
using System.Threading.Tasks;
using System.Xml.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

class Program
{
    public static int Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("Usage: archlens <input> [--output <file>] [--include ns1 ns2 ...] [--exclude ns3 ns4 ...]");
            return 1;
        }

        string input = args[0];
        string? output = null;
        var include = new List<string>();
        var exclude = new List<string>();

        for (int i = 1; i < args.Length; i++)
        {
            if (args[i] == "--output" && i + 1 < args.Length)
            {
                output = args[++i];
            }
            else if (args[i] == "--include")
            {
                while (i + 1 < args.Length && !args[i + 1].StartsWith("--"))
                {
                    include.Add(args[++i]);
                }
            }
            else if (args[i] == "--exclude")
            {
                while (i + 1 < args.Length && !args[i + 1].StartsWith("--"))
                {
                    exclude.Add(args[++i]);
                }
            }
        }

        // 本来の処理を呼び出す
        RunExtract(input, output, include, exclude).GetAwaiter().GetResult();
        return 0;
    }

    static async Task RunExtract(string inputPath, string? outputPath, List<string> includePatterns, List<string> excludePatterns)
    {
        if (!Directory.Exists(inputPath) && !File.Exists(inputPath))
        {
            Console.WriteLine($"Input path not found: {inputPath}");
            return;
        }
        string searchDir = inputPath;
        if (File.Exists(inputPath))
        {
            var ext = Path.GetExtension(inputPath).ToLower();
            if (ext == ".sln" || ext == ".csproj")
            {
                searchDir = Path.GetDirectoryName(inputPath)!;
            }
            else
            {
                Console.WriteLine("Input must be a directory, .csproj, or .sln file");
                return;
            }
        }
        var csFiles = Directory.GetFiles(searchDir, "*.cs", SearchOption.AllDirectories);
        Console.WriteLine($"Found {csFiles.Length} C# files.");
        var classes = new List<object>();
        var interfaces = new List<object>();
        foreach (var filePath in csFiles)
        {
            var code = await File.ReadAllTextAsync(filePath);
            var tree = CSharpSyntaxTree.ParseText(code);
            var root = tree.GetCompilationUnitRoot();
            var triviaDict = root.DescendantNodes()
                .OfType<MemberDeclarationSyntax>()
                .ToDictionary(
                    n => n,
                    n => n.GetLeadingTrivia().FirstOrDefault(t => t.IsKind(SyntaxKind.SingleLineDocumentationCommentTrivia) || t.IsKind(SyntaxKind.MultiLineDocumentationCommentTrivia))
                );
            foreach (var classNode in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                var ns = classNode.Parent is NamespaceDeclarationSyntax nsNode ? nsNode.Name.ToString() : "";
                if (!IsNamespaceIncluded(ns, includePatterns, excludePatterns)) continue;
                string? summary = null;
                if (triviaDict.TryGetValue(classNode, out var trivia) && trivia != default)
                {
                    var xml = trivia.ToFullString();
                    try
                    {
                        var doc = XDocument.Parse(xml.Replace("///", "").Trim());
                        summary = doc.Descendants("summary").FirstOrDefault()?.Value.Trim();
                    }
                    catch { }
                }
                var attributes = new List<string>();
                foreach (var field in classNode.Members.OfType<FieldDeclarationSyntax>())
                {
                    foreach (var v in field.Declaration.Variables)
                    {
                        attributes.Add($"{v.Identifier.Text}: {field.Declaration.Type}");
                    }
                }
                foreach (var prop in classNode.Members.OfType<PropertyDeclarationSyntax>())
                {
                    attributes.Add($"{prop.Identifier.Text}: {prop.Type}");
                }
                var methods = new List<object>();
                foreach (var method in classNode.Members.OfType<MethodDeclarationSyntax>())
                {
                    string? msummary = null;
                    if (triviaDict.TryGetValue(method, out var mtrivia) && mtrivia != default)
                    {
                        var xml = mtrivia.ToFullString();
                        try
                        {
                            var doc = XDocument.Parse(xml.Replace("///", "").Trim());
                            msummary = doc.Descendants("summary").FirstOrDefault()?.Value.Trim();
                        }
                        catch { }
                    }
                    methods.Add(new { name = method.Identifier.Text, summary = msummary });
                }
                var dependencies = new HashSet<string>();
                foreach (var field in classNode.Members.OfType<FieldDeclarationSyntax>())
                {
                    dependencies.Add(field.Declaration.Type.ToString());
                }
                foreach (var ctor in classNode.Members.OfType<ConstructorDeclarationSyntax>())
                {
                    foreach (var param in ctor.ParameterList.Parameters)
                    {
                        dependencies.Add(param.Type?.ToString() ?? "");
                    }
                }
                var implements = new List<string>();
                string? extends = null;
                if (classNode.BaseList != null)
                {
                    foreach (var baseType in classNode.BaseList.Types)
                    {
                        var t = baseType.Type.ToString();
                        if (extends == null)
                            extends = t;
                        else
                            implements.Add(t);
                    }
                }
                classes.Add(new {
                    name = classNode.Identifier.Text,
                    @namespace = ns,
                    summary = summary,
                    attributes = attributes,
                    methods = methods,
                    dependencies = dependencies.Where(d => !string.IsNullOrWhiteSpace(d)).Distinct().ToList(),
                    implements = implements.Count > 0 ? implements : null,
                    extends = extends
                });
            }
            foreach (var interfaceNode in root.DescendantNodes().OfType<InterfaceDeclarationSyntax>())
            {
                var ns = interfaceNode.Parent is NamespaceDeclarationSyntax nsNode ? nsNode.Name.ToString() : "";
                if (!IsNamespaceIncluded(ns, includePatterns, excludePatterns)) continue;
                var methods = new List<object>();
                foreach (var method in interfaceNode.Members.OfType<MethodDeclarationSyntax>())
                {
                    string? msummary = null;
                    if (triviaDict.TryGetValue(method, out var mtrivia) && mtrivia != default)
                    {
                        var xml = mtrivia.ToFullString();
                        try
                        {
                            var doc = XDocument.Parse(xml.Replace("///", "").Trim());
                            msummary = doc.Descendants("summary").FirstOrDefault()?.Value.Trim();
                        }
                        catch { }
                    }
                    methods.Add(new { name = method.Identifier.Text, summary = msummary });
                }
                interfaces.Add(new {
                    name = interfaceNode.Identifier.Text,
                    @namespace = ns,
                    methods = methods
                });
            }
        }
        var result = new {
            classes = classes,
            interfaces = interfaces
        };
        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
        if (!string.IsNullOrWhiteSpace(outputPath))
        {
            await File.WriteAllTextAsync(outputPath, json);
            Console.WriteLine($"Output written to: {outputPath}");
        }
        else
        {
            Console.WriteLine(json);
        }
    }

    static bool WildcardMatch(string text, string pattern)
    {
        if (pattern == "*") return true;
        var parts = pattern.Split('*');
        int pos = 0;
        foreach (var part in parts)
        {
            if (part == "") continue;
            int idx = text.IndexOf(part, pos, StringComparison.Ordinal);
            if (idx == -1) return false;
            pos = idx + part.Length;
        }
        if (!pattern.EndsWith("*"))
            return text.EndsWith(parts.Last());
        return true;
    }
    static bool IsNamespaceIncluded(string ns, List<string> includes, List<string> excludes)
    {
        bool included = includes.Count == 0 || includes.Any(p => WildcardMatch(ns, p));
        bool excluded = excludes.Any(p => WildcardMatch(ns, p));
        return included && !excluded;
    }
}
