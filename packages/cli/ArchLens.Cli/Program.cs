using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("Usage: ArchLens.Cli <path-to-cs-file>");
            return;
        }
        var filePath = args[0];
        if (!File.Exists(filePath))
        {
            Console.WriteLine($"File not found: {filePath}");
            return;
        }
        var code = File.ReadAllText(filePath);
        var tree = CSharpSyntaxTree.ParseText(code);
        var root = tree.GetCompilationUnitRoot();

        var classes = new List<object>();
        var interfaces = new List<object>();

        foreach (var classNode in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
        {
            var methods = new List<string>();
            foreach (var method in classNode.Members.OfType<MethodDeclarationSyntax>())
            {
                methods.Add(method.Identifier.Text);
            }
            classes.Add(new {
                name = classNode.Identifier.Text,
                methods = methods
            });
        }
        foreach (var interfaceNode in root.DescendantNodes().OfType<InterfaceDeclarationSyntax>())
        {
            var methods = new List<string>();
            foreach (var method in interfaceNode.Members.OfType<MethodDeclarationSyntax>())
            {
                methods.Add(method.Identifier.Text);
            }
            interfaces.Add(new {
                name = interfaceNode.Identifier.Text,
                methods = methods
            });
        }
        var result = new {
            classes = classes,
            interfaces = interfaces
        };
        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
        Console.WriteLine(json);
    }
}
